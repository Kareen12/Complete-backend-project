import connectDB from "./db/db.js";
// require('dotenv').config({path: './env'})
// Another way
import dotenv from "dotenv";

dotenv.config({ path: "./env" });

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000),
      () => {
        console.log(`Server is running at port: ${process.env.PORT}`);
      };
  })
  .catch((err) => {
    console.log("Database Connection failed !", err);
  });
