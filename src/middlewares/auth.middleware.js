import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // request has access to cookies
    // kabhi kabar token req ki header me hota h in the form - Authorization: Bearer <Token> so we only need token not bearer written so we use replace method
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", ""); // here we are talking about accessToken

    if (!token) {
      throw new ApiError(401, "Token not found, unauthorized request");
    }

    // now verifying if the token is correct or not
    const verifiedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(verifiedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Inavlid Accesss Token");
    }
    req.user = user;
    next();
  } catch (err) {
    throw new ApiError(401, err?.message, "Invalid access token");
  }
});
