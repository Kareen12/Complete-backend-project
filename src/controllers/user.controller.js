import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // get user deatils from frontend
  const { fullname, email, username, password } = req.body;
  // console.log("Email:", email);

  // validation and check empty

  // The some method is an array method that tests whether at least one element in the array passes the test implemented by the provided function.
  // It returns true if at least one element passes the test and false otherwise.
  // (field) => field?.trim() === ""
  // This is an arrow function that takes one parameter, field. It checks whether the field is an empty string or contains only whitespace
  //   characters after trimming.
  // Optional Chaining (?.):
  // The optional chaining operator (?.) ensures that if field is null or undefined, the function doesn't throw an error and returns undefined instead.
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // check if user already exists
  const userExist = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (userExist) {
    throw new ApiError(400, "User Already exists");
  }

  // check for images and avatar

  // The ?. operator is used to safely access nested properties.
  // If any part of the chain is null or undefined, the entire expression will short-circuit and return undefined instead of throwing an error.
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage && req.files.coverImage.length > 0)
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  // upload images to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // if (coverImageLocalPath) {
  //   const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  // create user object - entry in db
  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
  });

  // remove password and refreshToken field
  // now if the user is successfully created we use select method to remove the entries like password we do not want to be sent or visible
  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!userCreated) {
    throw new ApiError(500, "User not created");
  }

  // if user created sucesssfully send response otherwise error
  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "User Registered Successfully"));
});

export { registerUser };
