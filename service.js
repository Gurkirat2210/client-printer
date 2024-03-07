const axios = require("axios");
const fs = require("fs");

async function retrieveJob(job) {
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
                await fs.writeFileSync(fileName, pdf.data);
                return true;
            }
        } catch (error) {
            console.log(error);
        }
    }
    return false;
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

async function handlePayload(body, event) {
    if (validatePayload(body, event)) {
        return;
    }

    event.reply("log", `Job#${body.jobId}, PROCESSING..`);
    const ack = {
        jobId: body.jobId,
        printServerPassword: printer.password
    };
    ack.success = await retrieveJob(body);
    event.reply("log", `Job#${body.jobId}, success: ${ack.success}, sending ACK: ${JSON.stringify(ack)}`);
    ack.success = await sendAck(ack);
    if (ack.success.status === 200) {
        event.reply("log", `Job#${body.jobId}, PROCESSED.`);
    } else {
        event.reply("log", `Job#${body.jobId}, ACK FAILED.`);
    }
}

function validatePayload(body, event) {
    try {
        event.reply("log", `Received payload, ${body}`);
        body = JSON.parse(body);
        return body.jobId;
    } catch (error) {
        event.reply("log", `Invalid payload, ${body}`);
        return false;
    }
}

module.exports = {
    handlePayload
}