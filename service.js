const axios = require("axios");
const fs = require("fs");
const {printService, printer, maxAttempts} = require("./config.json");

async function retrieveJob(job, ipc) {
    const jobId = job["jobId"];
    const config = {
        baseURL: printService.url,
        url: `/RetrieveJob/${jobId}?printServerPassword=${encodeURIComponent(printer.password)}`,
        method: 'get',
        responseType: 'arraybuffer',
        responseEncoding: 'binary',
    };
    const fileName = `${__dirname}/pdf/${new Date().getTime()}_${jobId}.pdf`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const pdf = await axios(config);
            if (pdf.data && pdf.data.length > 0) {
                ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: Writing pdf ${fileName}`);
                await fs.writeFileSync(fileName, pdf.data);
                //todo print & delete file
                return true;
            }
        } catch (error) {
            ipc.reply("log", `Job#${jobId}: Attempt#${attempt}/${maxAttempts}: Retrieve ERROR: ${error.message}`);
            console.log(error);
        }
    }
    return false;
}

async function sendAck(job, ipc) {
    const config = {
        baseURL: printService.url,
        url: `/UpdatePrintJobStatus/${printer.uuid}`,
        method: 'post',
        contentType: 'application/json',
        data: job
    };
    try {
        const response = await axios(config);
        ipc.reply("log", `Job#${job.jobId}: ACK status: (${response.status}) ${response.status === 200 ? "SENT" : "FAILED"}.`);
    } catch (error) {
        ipc.reply("log", `Job#${job.jobId}: ACK ERROR: ${error.message}`);
        console.log(error);
    }
}

async function handlePayload(body, ipc) {
    if (!validatePayload(body, ipc)) {
        return;
    }
    body = JSON.parse(body);
    ipc.reply("log", `Job#${body.jobId}: PROCESSING..`);
    const ack = {
        jobId: body.jobId,
        printServerPassword: printer.password
    };
    ack.success = await retrieveJob(body, ipc);
    ipc.reply("log", `Job#${body.jobId}: PRINTED: ${ack.success}: Sending ACK: ${JSON.stringify(ack)}`);
    await sendAck(ack, ipc);
}

function validatePayload(body, ipc) {
    try {
        ipc.reply("log", `Received payload, ${body}`);
        body = JSON.parse(body);
        return body;
    } catch (error) {
        ipc.reply("log", `Invalid payload, ${body}`);
        return false;
    }
}

async function getJobs(ipc) {
    const jobs = await axios.get(`${printService.url}/PrintJobs/${printer.uuid}`, {
        headers: {
            'Authorization': printer.password
        }
    });
    return jobs?.data;
}


module.exports = {
    handlePayload,
    getJobs
}