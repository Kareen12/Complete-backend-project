import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// for accepting json request
app.use(
  express.json({
    limit: "16kb",
  })
);

// when data is coming from url so that also includes special characters so that needs to be converted to desired form using below line of code
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// sometimes there are public assests where data needs to be stored
app.use(express.static("public"));

// to access or perform CRUD operations on users' cookie from their browser
app.use(cookieParser());
export { app };
