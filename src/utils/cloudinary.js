import { v2 as cloudinary } from "cloudinary";

// fs is file system which is inbuilt library in nodejs which need not to installed, it is used to read ,write etc in file
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const uploadOnCloudinary = async (loclalFilePath) => {
  try {
    if (!loclalFilePath) return null;

    // upload file on cloudinary
    const response = await cloudinary.uploader.upload(loclalFilePath, {
      resource_type: "auto",
    });

    // after uploading successssfully
    // console.log("File uploaded Successfully", response.url);
    fs.unlinkSync(loclalFilePath);
    return response;
  } catch (err) {
    // this removes localfile from the server which has been failed to be uploaded due to some error
    fs.unlinkSync(loclalFilePath);
    return null;
  }
};

export { uploadOnCloudinary };
