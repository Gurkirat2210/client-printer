const axios = require("axios");
const fs = require("fs");
const {printService, printer, maxAttempts, fileNameTimestampFmt} = require("./config.json");
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
    throw new Error ('received null or empty pdf data stream')
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
    throw new Error ('received null or empty pdf data stream')
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
    ipc.send("log", `Job#${jobId}: PROCESSING..`);
    const fileName = `${__dirname}/pdf/${moment().format(fileNameTimestampFmt)}_${jobId}.pdf`;
    const ack = {
        jobId: jobId,
        printServerPassword: printer.password
    };
    do {
        try {
            ipc.send("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: retrieving pdf..`);
            const pdfStream = await retrieveJob(body, ipc);
            ipc.send("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: printing pdf ${fileName}..`);
            await fs.writeFileSync(fileName, pdfStream);
            //todo print & delete file
            ack.success = true;
        } catch (error) {
            ipc.send("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: ERROR: ${error.message}`);
        }
        attempt++;
    } while (!ack.success && attempt <= maxAttempts);

    if (ack.success || attempt > maxAttempts) {
        try {
            ipc.send("log", `Job#${jobId}: Sending ACK: ${JSON.stringify(ack)}`);
            const ackRes = await sendAck(ack, ipc);
            ipc.send("log", `Job#${jobId}: ACK status: (${ackRes.status}) ${ackRes.status === 200 ? "SENT" : "FAILED"}.`);
            return true;
        } catch (error) {
            ipc.send("log", `Job#${jobId}: ACK ERROR: ${error.message}.`);
        }
    }

    return false;
}


module.exports = {
    handlePayload,
    getJobs,
    testRetrieveJob
}