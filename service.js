const axios = require("axios");
const fs = require("fs");
const {fileNameTimestampFmt} = require("./app-config.json");
const {printService, printer} = require("./print-config.json");
const moment = require("moment");

async function getJobs() {
    const jobs = await axios.get(`${printService.url}/PrintJobs/${printer.uuid}`, {
        headers: {
            'Authorization': printer.password
        }
    });
    return jobs?.data;
}

async function retrieveJob(job) {
    const jobId = job["jobId"];
    const config = {
        baseURL: printService.url,
        url: `/RetrieveJob/${jobId}?printServerPassword=${encodeURIComponent(printer.password)}`,
        method: 'get',
        responseType: 'arraybuffer',
        responseEncoding: 'binary',
    };
    const pdf = await axios(config);
    if (pdf.data && pdf.data.length > 0) {
        return pdf.data;
    }
    throw new Error('received null or empty pdf data stream')
}

async function testRetrieveJob() {
    const config = {
        baseURL: printService.url,
        url: `/TestRetrieveJob/${printer.uuid}`,
        method: 'get',
        responseType: 'arraybuffer',
        responseEncoding: 'binary',
        headers: {
            'Authorization': printer.password
        }
    };
    const pdf = await axios(config);
    if (pdf.data && pdf.data.length > 0) {
        return pdf.data;
    }
    throw new Error('received null or empty pdf data stream')
}

async function sendAck(job) {
    const config = {
        baseURL: printService.url,
        url: `/UpdatePrintJobStatus/${printer.uuid}`,
        method: 'post',
        contentType: 'application/json',
        data: job
    };
    const response = await axios(config);
    return response;
}

async function handlePrintOrder(body, ipc) {
    const jobId = body.jobId;
    let attempt = 1;
    ipc.reply("log", `Job#${jobId}: PROCESSING..`);
    const ack = {
        jobId: jobId,
        printServerPassword: printer.password,
        fileName: `${pdfPath}/${moment().format(fileNameTimestampFmt)}_${jobId}.pdf`
    };
    do {
        try {
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${printService.maxAttempts}: retrieving pdf..`);
            const pdfStream = await retrieveJob(body, ipc);
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${printService.maxAttempts}: printing pdf ${ack.fileName}..`);
            await fs.writeFileSync(ack.fileName, pdfStream);
            //todo print & delete file
            ack.success = true;
        } catch (error) {
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${printService.maxAttempts}: ERROR: ${error.message}`);
        }
        attempt++;
    } while (!ack.success && attempt <= printService.maxAttempts);

    if (ack.success || attempt > printService.maxAttempts) {
        try {
            ipc.reply("log", `Job#${jobId}: Sending ACK: ${JSON.stringify(ack)}`);
            const ackRes = await sendAck(ack, ipc);
            ack.success = ackRes.status === 200;
            ipc.reply("log", `Job#${jobId}: ACK status: (${ackRes.status}) ${ack.success ? "SENT" : "FAILED"}.`);
        } catch (error) {
            ipc.reply("log", `Job#${jobId}: ACK ERROR: ${error.message}.`);
        }
    }
    return ack;
}

async function startPolling(ipc, stats, pdfPath) {
    let pollingCfg;
    try {
        const poll = async () => {
            await process(ipc, stats, pdfPath);
            ipc.reply("log", `Sleeping for ${printService.poll / 1000} seconds.`);
            ipc.reply("stats", stats);
        }

        await poll();
        pollingCfg = setInterval(poll, printService.poll);
        updatePollStatus(pollingCfg, ipc);
    } catch (error) {
        updatePollStatus(null, ipc, error.message);
    }
    return pollingCfg;
}

async function process(ipc, stats, pdfPath) {
    const jobs = await getJobs(ipc);
    if (!jobs.length) {
        ipc.reply("log", "No jobs found");
    }
    for (let i in jobs) {
        const ack= await handlePrintOrder(jobs[i], ipc, pdfPath)
        if (ack.success) {
            stats.last.fileName = ack.fileName;
            stats.last.at = moment().toLocaleString();
            stats.last.jobId = jobs[i].jobId;
            stats.processed++;
        } else {
            stats.failed++;
        }
    }
}

function subscribeToMq(ipc, stompClient, activeMq, stats, pdfPath, callback) {
    let stompSession;
    stompClient.connect((sessionId) => {
        stompSession = sessionId;
        updateMQStatus(stompSession, ipc);
        stompClient.subscribe(activeMq.queue, async (body, headers) => {
            try {
                ipc.reply("log", `Received message, ${body}`);
                body = JSON.parse(body);
                if (body.jobId == -1) {
                    return true;
                }
                if (body.jobId == 0) {
                    await process(ipc, stats, pdfPath);
                }
            } catch (error) {
                ipc.reply("log", `handling failed, ERROR: ${error.message}`);
            }
            ipc.reply("stats", stats);
        });
        return callback(stompSession);
    }, (error) => {
        updateMQStatus(null, ipc, error.message);
        return callback(null);
    });
}

function updatePollStatus(pollingCfg, ipc, error) {
    if (pollingCfg?._onTimeout) {
        ipc.reply("status", {
            success: true,
            type: 'poll',
            status: `✔ Polling (${pollingCfg._idleTimeout / 1000} secs)`
        });
    } else {
        ipc.reply("status", {
            success: false,
            type: 'poll',
            error: `✘ Polling Off` + (error ? ` (${error})` : '')
        });
    }
}

function updateMQStatus(stompSession, ipc, error) {
    if (stompSession) {
        ipc.reply("status", {
            success: true,
            type: 'mq',
            status: `✔ MQ Connected (${stompSession})`
        });
    } else {
        ipc.reply("status", {
            success: false,
            type: 'mq',
            error: `✘ MQ Disconnected` + (error ? ` (${error})` : '')
        });
    }
}

module.exports = {
    subscribeToMq,
    testRetrieveJob,
    startPolling,
    updateMQStatus,
    updatePollStatus
}