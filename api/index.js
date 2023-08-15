const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User.js");
const path=require('path')
const Place = require("./models/Place.js");
const Booking = require("./models/Booking.js");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const fs = require("fs");
const mime = require("mime-types");
// const cors = require("cors");

require("dotenv").config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "fasefraw4r5r3wq45wdfgw34twdfg";
const bucket = "mahesh-project-airstay";

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(cors({
    origin:"http://localhost:5174",
    credentials:true,
}));
mongoose.connect(process.env.MONGO_URL);

app.use(function (req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5174");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "X-Requested-With,content-type"
    );
    res.setHeader("Access-Control-Allow-Credentials", true);
    next();
});

// async function uploadToS3(path, originalFilename, mimetype) {
//     const client = new S3Client({
//         region: "us-east-1",
//         credentials: {
//             accessKeyId: process.env.S3_ACCESS_KEY,
//             secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
//         },
//     });
//     const parts = originalFilename.split(".");
//     const ext = parts[parts.length - 1];
//     const newFilename = Date.now() + "." + ext;
//     await client.send(
//         new PutObjectCommand({
//             Bucket: bucket,
//             Body: fs.readFileSync(path),
//             Key: newFilename,
//             ContentType: mimetype,
//             ACL: "public-read",
//         })
//     );
//     return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
// }

function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            resolve(userData);
        });
    });
}

app.get("/api/test", (req, res) => {
    
    res.json("test ok");
});

app.post("/api/register", async (req, res) => {
    
    const { name, email, password } = req.body;

    try {
        const userDoc = await User.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        res.json(userDoc);
    } catch (e) {
        res.status(422).json(e);
    }
});

app.post("/api/login", async (req, res) => {
    
    const { email, password } = req.body;
    const userDoc = await User.findOne({ email });

    if (userDoc) {
        const passOk = bcrypt.compareSync(password, userDoc.password);
        if (passOk) {
            jwt.sign(
                {
                    email: userDoc.email,
                    id: userDoc._id,
                },
                jwtSecret,
                {},
                (err, token) => {
                    if (err) throw err;
                    res.cookie("token", token).json(userDoc);
                }
            );
        } else {
            res.status(422).json("pass not ok");
        }
    } else {
        res.json("not found");
    }
});

app.get("/api/profile", (req, res) => {
    
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            const { name, email, _id } = await User.findById(userData.id);
            res.json({ name, email, _id });
        });
    } else {
        res.json(null);
    }
});

app.post("/api/logout", (req, res) => {
    res.cookie("token", "").json(true);
});

app.post("/api/upload-by-link", async (req, res) => {
    try {
        const { link } = req.body;
        const newName = "photo" + Date.now() + ".jpg";
        await imageDownloader.image({
            url: link,
            dest: "tmp/" + newName,
        });
        // const url = await uploadToS3(
        //     "/tmp/" + newName,
        //     newName,
        //     mime.lookup("/tmp/" + newName)
        // );
        res.json(link);
    } catch (err) {
        console.log(err);
        res.json({
            err: err,
        });
    }
});

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
  
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
  
var upload = multer({ storage: storage })

app.post(
    "/api/upload",
    upload.array("photos", 100),
    async (req, res) => {
        try {
            const uploadedFiles = [];
            for (let i = 0; i < req.files.length; i++) {
                const { path, originalname, mimetype } = req.files[i];
                // const url = await uploadToS3(path, originalname, mimetype);
                // console.log()
                uploadedFiles.push(path.split('uploads/')[1]);
            }
            res.json(uploadedFiles);
        } catch (err) {
            console.log(err);
            res.json({
                success: false,
                err,
            });
        }
    }
);

app.post("/api/places", (req, res) => {
    
    const { token } = req.cookies;
    const {
        title,
        address,
        addedPhotos,
        description,
        price,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
    } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.create({
            owner: userData.id,
            price,
            title,
            address,
            photos: addedPhotos,
            description,
            perks,
            extraInfo,
            checkIn,
            checkOut,
            maxGuests,
        });
        res.json(placeDoc);
    });
});

app.get("/api/user-places", (req, res) => {
    
    const { token } = req.cookies;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        const { id } = userData;
        res.json(await Place.find({ owner: id }));
    });
});

app.get("/api/places/:id", async (req, res) => {
    
    const { id } = req.params;
    res.json(await Place.findById(id));
});

app.put("/api/places", async (req, res) => {
    
    const { token } = req.cookies;
    const {
        id,
        title,
        address,
        addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
    } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title,
                address,
                photos: addedPhotos,
                description,
                perks,
                extraInfo,
                checkIn,
                checkOut,
                maxGuests,
                price,
            });
            await placeDoc.save();
            res.json("ok");
        }
    });
});

app.get("/api/places", async (req, res) => {
    
    res.json(await Place.find());
});

app.post("/api/bookings", async (req, res) => {
    
    const userData = await getUserDataFromReq(req);
    const { place, checkIn, checkOut, numberOfGuests, name, phone, price } =
        req.body;
    Booking.create({
        place,
        checkIn,
        checkOut,
        numberOfGuests,
        name,
        phone,
        price,
        user: userData.id,
    })
        .then((doc) => {
            res.json(doc);
        })
        .catch((err) => {
            throw err;
        });
});

app.get("/api/bookings", async (req, res) => {
    
    const userData = await getUserDataFromReq(req);
    res.json(await Booking.find({ user: userData.id }).populate("place"));
});

app.listen(4000, function (err) {
    if (err) console.log("Error in server setup");
    console.log("Server listening on Port", 4000);
});
