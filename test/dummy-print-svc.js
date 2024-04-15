const path = require("node:path");
const app = require("express")();
const port = 8080;

app.get('/TestRetrieveJob/*', (req, res) => {
    res.send(path.join(__dirname, 'test.pdf'));
});

app.get('/PrintJobs/*', (req, res) => {
    res.send([]);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});