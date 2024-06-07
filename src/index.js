import connectDB from "./db/db.js";
// require('dotenv').config({path: './env'})
// Another way
import dotenv from "dotenv";

dotenv.config({ path: "./env" });

connectDB();
