const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors');
const cli = require('nodemon/lib/cli');

//middleware
app.use(cors())
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pkwhn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await client.connect()
    console.log("Db is connected");
    const newCollection = client.db("computerPartsManufacturer").collection("newItems");
    const serviceCollection = client.db("computerPartsManufacturer").collection("services");
    const partsCollection = client.db("computerPartsManufacturer").collection("parts");

    try {
        // Getting data





        app.get("/parts", async (req, res) => {
            const query = {}
            const result = await partsCollection.find(query).toArray()
            res.send(result);
        })
        app.get("/new", async (req, res) => {
            const query = {}
            const result = await newCollection.find(query).toArray()
            res.send(result);
        })
        app.get("/services", async (req, res) => {
            const query = {}
            const result = await serviceCollection.find(query).toArray()
            res.send(result);
        })

    }
    finally {
        // client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send("Server Home page");
})

app.listen(port, () => {
    console.log("Server is running");
})