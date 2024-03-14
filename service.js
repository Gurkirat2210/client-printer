const axios = require("axios");
const fs = require("fs");
const {printService, printer, maxAttempts, fileNameTimestampFmt} = require("./config.json");
const moment = require("moment");

async function getJobs(ipc) {
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
    return null;
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
    return response.status === 200;
}

async function handlePayload(body, ipc) {
    const jobId = body.jobId;
    let attempt = 1;
    ipc.reply("log", `Job#${jobId}: PROCESSING..`);
    const fileName = `${__dirname}/pdf/${moment().format(fileNameTimestampFmt)}_${jobId}.pdf`;
    const ack = {
        jobId: jobId,
        printServerPassword: printer.password
    };
    do {
        try {
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: retrieving pdf..`);
            const pdfStream = await retrieveJob(body, ipc);
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: printing pdf..`);
            await fs.writeFileSync(fileName, pdfStream);
            //todo print & delete file
            ack.success = true;
        } catch (error) {
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: ERROR: ${error.message}`);
        }
        attempt++;
    } while (!ack.success && attempt <= maxAttempts);

    if (ack.success || attempt > maxAttempts) {
        try {
            ipc.reply("log", `Job#${jobId}: Sending ACK: ${JSON.stringify(ack)}`);
            const ackRes = await sendAck(ack, ipc);
            ipc.reply("log", `Job#${jobId}: ACK status: (${ackRes.status}) ${ackRes.status === 200 ? "SENT" : "FAILED"}.`);
            return true;
        } catch (error) {
            ipc.reply("log", `Job#${jobId}: ACK ERROR: ${error.message}.`);
        }
    }

    return false;
}


module.exports = {
    handlePayload,
    getJobs
}