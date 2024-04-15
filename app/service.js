const axios = require("axios");
const fs = require("fs");
const {fileNameTimestampFmt, defaultCfg, exportFolder} = require("./config.json");
const moment = require("moment");
const Stomp = require("stomp-client");
const path = require("node:path");
const {app} = require("electron");

async function getJobs(cfg) {
    const jobs = await axios.get(`${cfg.svc.url}/PrintJobs/${cfg.printer.uuid}`, {
        headers: {
            'Authorization': cfg.printer.password
        }
    });
    return jobs?.data;
}

async function retrieveJob(job, cfg) {
    const jobId = job["jobId"];
    const config = {
        baseURL: cfg.svc.url,
        url: `/RetrieveJob/${jobId}?printServerPassword=${encodeURIComponent(cfg.printer.password)}`,
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

async function testRetrieveJob(cfg) {
    const config = {
        baseURL: cfg.svc.url,
        url: `/TestRetrieveJob/${cfg.printer.uuid}`,
        method: 'get',
        responseType: 'arraybuffer',
        responseEncoding: 'binary',
        headers: {
            'Authorization': cfg.printer.password
        }
    };
    const pdf = await axios(config);
    if (pdf.data && pdf.data.length > 0) {
        return pdf.data;
    }
    throw new Error('received null or empty pdf data stream')
}

async function sendAck(job, cfg) {
    const config = {
        baseURL: cfg.svc.url,
        url: `/UpdatePrintJobStatus/${cfg.printer.uuid}`,
        method: 'post',
        contentType: 'application/json',
        data: job
    };
    const response = await axios(config);
    return response;
}

async function handlePrintOrder(body, ipc, cfg) {
    const jobId = body.jobId;
    let attempt = 1;
    ipc.reply("log", `Job#${jobId}: PROCESSING`);
    const ack = {
        jobId: jobId,
        printServerPassword: cfg.printer.password,
        fileName: `${cfg.pdfPath}/${moment().format(fileNameTimestampFmt)}_${jobId}.pdf`
    };
    do {
        try {
            ipc.reply("log", `Job#${jobId}: Retrieving pdf`);
            const pdfStream = await retrieveJob(body, cfg);
            ipc.reply("log", `Job#${jobId}: Printing pdf ${ack.fileName}`);
            await fs.writeFileSync(ack.fileName, pdfStream);
            //todo print & delete file
            ack.success = true;
        } catch (error) {
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${cfg.svc.attempts} failed: ERROR: ${error.message}`);
        }
        attempt++;
    } while (!ack.success && attempt <= cfg.svc.attempts);

    try {
        ipc.reply("log", `Job#${jobId}: Sending ACK: ${JSON.stringify(ack)}`);
        const ackRes = await sendAck(ack, cfg);
        ack.success = ackRes.status === 200;
        ipc.reply("log", `Job#${jobId}: ACK status: (${ackRes.status}) ${ack.success ? "SENT" : "FAILED"}.`);
    } catch (error) {
        ipc.reply("log", `Job#${jobId}: ACK ERROR: ${error.message}.`);
    }

    return ack;
}

async function startPolling(ipc, stats, cfg) {
    if (cfg.svc.poll < 30000) {
        cfg.svc.poll = 30000;
    }
    let pollingCfg;
    try {
        const poll = async () => {
            await process(ipc, stats, cfg);
            ipc.reply("log", `Sleeping for ${cfg.svc.poll / 1000} seconds`);
            ipc.reply("stats", stats);
        }

        await poll();
        pollingCfg = setInterval(poll, cfg.svc.poll);
        updatePollStatus(pollingCfg, ipc);
    } catch (error) {
        updatePollStatus(null, ipc, error.message);
    }
    return pollingCfg;
}

async function process(ipc, stats, cfg) {
    const jobs = await getJobs(cfg);
    if (!jobs.length) {
        ipc.reply("log", "No jobs found");
    }
    for (let i in jobs) {
        const ack = await handlePrintOrder(jobs[i], ipc, cfg)
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

function subscribeToMq(ipc, stats, cfg, callback) {
    const stompClient = new Stomp({
        host: cfg.mq?.host,
        port: cfg.mq?.port,
    });
    stompClient.connect((sessionId) => {
        updateMQStatus(sessionId, ipc);
        stompClient.subscribe(cfg.mq.queue, async (body, headers) => {
            const msgId = headers["message-id"];
            try {
                ipc.reply("log", `${msgId}: Received message, ${body}`);
                body = JSON.parse(body);
                if (body.jobId == -1) {
                    return true;
                }
                if (body.jobId == 0) {
                    await process(ipc, stats, cfg);
                }
            } catch (error) {
                ipc.reply("log", `${msgId}: Processing failed, ERROR: ${error.message}`);
            }
            ipc.reply("stats", stats);
        });
        return callback(stompClient, sessionId);
    }, (error) => {
        updateMQStatus(null, ipc, error.message);
        return callback();
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

function initFoldersAndCfg(app) {
    let cfg = defaultCfg;
    const exportPath = path.join(app.getPath('home'), exportFolder);
    if (!fs.existsSync(exportPath)) {
        fs.mkdirSync(exportPath);
    }
    cfg.configPath = path.join(exportPath, 'print-config.json');
    if (fs.existsSync(cfg.configPath)) {
        cfg = require(cfg.configPath);
        cfg.configPath = path.join(exportPath, 'print-config.json');
    }
    cfg.pdfPath = path.join(exportPath, 'pdf');
    if (!fs.existsSync(cfg.pdfPath)) {
        fs.mkdirSync(cfg.pdfPath);
    }
    cfg.logPath = path.join(exportPath, 'log');
    if (!fs.existsSync(cfg.logPath)) {
        fs.mkdirSync(cfg.logPath);
    }
    return cfg;
}

module.exports = {
    subscribeToMq,
    testRetrieveJob,
    startPolling,
    updateMQStatus,
    updatePollStatus,
    initFoldersAndCfg
}