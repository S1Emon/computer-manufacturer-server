const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

//middleware
app.use(cors())
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pkwhn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    await client.connect()
    console.log("Db is connected");
    const newCollection = client.db("computerPartsManufacturer").collection("newItems");
    const serviceCollection = client.db("computerPartsManufacturer").collection("services");
    const partsCollection = client.db("computerPartsManufacturer").collection("parts");
    const orderCollection = client.db("computerPartsManufacturer").collection("orders");
    const userCollection = client.db("computerPartsManufacturer").collection("users");
    const paymentCollection = client.db("computerPartsManufacturer").collection("payment");
    const reviewCollection = client.db("computerPartsManufacturer").collection("review");

    try {
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        })


        // Getting data
        app.get("/parts", async (req, res) => {
            const query = {}
            const result = await partsCollection.find(query).toArray()
            res.send(result);
        })
        app.get("/part/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const part = await partsCollection.findOne(query);
            res.send(part)
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

        app.get("/available", async (req, res) => {
            const available = req.body.available;

            const parts = await partsCollection.find().toArray()
            const query = { available: available };

            const orders = await orderCollection.find(query).toArray()

            orders.forEach(order => {
                const partsOrders = orders.filter(order => order.name === parts.name);
            })
            res.send(parts)
        })

        // get orders 
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const order = await orderCollection.find(query).toArray();
                return res.send(order);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        });

        app.get("/orders/:id", verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const orders = await orderCollection.findOne(query)
            res.send(orders);
        })

        // get users 
        app.get("/user", verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get("/review", async (req, res) => {
            const review = await reviewCollection.find().toArray();
            res.send(review)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        //Insert Data
        app.post("/orders", verifyJWT, async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        })

        app.post("/parts", verifyJWT, verifyAdmin, async (req, res) => {
            const newParts = req.body
            const result = await partsCollection.insertOne(newParts)
            res.send(result);
        })
        app.post("/review", verifyJWT, async (req, res) => {
            const newReview = req.body
            const result = await reviewCollection.insertOne(newReview)
            res.send(result);
        })
        //Delete
        app.delete('/parts/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await partsCollection.deleteOne(query)
            res.send(result);
        })

        //Update Data
        app.put("/user/:email", async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updateDoc, option);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1hr' })
            res.send({ result, token })
        })

        app.patch("/orders/:id", verifyJWT, async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment)
            const updateOrder = await orderCollection.updateOne(filter, updateDoc)
            res.send(updateDoc);
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
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