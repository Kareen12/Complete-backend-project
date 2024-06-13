import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

// Generate Tokens
const generateAccessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // saving refreshToken to db
    user.refreshToken = refreshToken; // user model has refreshtoken as a field
    await user.save({ validateBeforeSave: false }); // validateBeforeSave is set false to make sure password is not saved and validated again

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access or Refresh token"
    );
  }
};

// register controller
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
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
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

//login controller
const loginUser = asyncHandler(async (req, res) => {
  // data from request body
  const { username, email, password } = req.body;

  // validation and check empty
  // if ([email, username, password].some((field) => field?.trim() === "")) {
  //   throw new ApiError(400, "All fields are required");
  // }

  if (!(username || email)) {
    throw new ApiError(400, "Username and  Email are required");
  }

  const userExistorNot = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!userExistorNot) {
    throw new ApiError(404, "User does not exists, please register");
  }

  // password check
  const isPasswordvalid = await userExistorNot.isPasswordCorrect(password);

  if (!isPasswordvalid) {
    throw new ApiError(400, "Incorrect Password");
  }
  // generate access and refresh token
  const { accessToken, refreshToken } = await generateAccessandRefreshToken(
    userExistorNot._id
  );

  // send cookie
  const loggedInUser = await User.findById(userExistorNot._id).select(
    "-password -refreshToken"
  ); // this logged in user has tokens

  // these options make sure that cookies are only modifiable by server only not  by default from front end
  const options = {
    httpOnly: true,
    secure: true,
  };

  // send response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

// Logout user
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out Successfully"));
});

// when users access token gets expired they can send refresh token in the request, if it gets matched with what is stored in server then they can get the session started again without login
const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const { userRefreshToken } =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!userRefreshToken) {
      throw new ApiError(400, "Refresh Token not found(unauthorized request)");
    }

    const verifyToken = jwt.verify(
      userRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(verifyToken._id);

    if (!user) {
      throw new ApiError(404, "Invalid refresh token");
    }

    // now checking if refresh tokens match
    if (userRefreshToken !== user?.refreshToken) {
      throw new ApiError(400, "Refresh Tokens does not match");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { newAccessToken, newRefreshToken } =
      await generateAccessandRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Invalid Refresh Token");
  }
});

// change password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  // checking if old password that user has entered is correct or not
  const passwordCheck = await user.isPasswordCorrect(oldPassword);

  if (!passwordCheck) {
    throw new ApiError(400, "Incorrect old password");
  }

  // now since the password is correct updating the password
  user.password = newPassword;
  await user.save({ validateBeforeSave: flase });

  // return response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed Successfully"));
});

// get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched Successfully"));
});

// Update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "Fields are empty");
  }

  const user = await User.findByIdAndDelete(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated Successfully"));
});

//update avatar
const updateAvatar = asyncHandler(async (req, res) => {
  const { avatarLocalPath } = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Failed uploading Avatar to cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated Successfully"));
});

//update avatar
const updateCoverImage = asyncHandler(async (req, res) => {
  const { coverImageLocalPath } = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Failed uploading Cover Image to cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated Successfully"));
});

// Channel Details
const getUserChannelDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Inavlid url, username is missing");
  }

  //  instead of finding user from username then with id finding all the details we'll use aggregate pipelines
  const channel =
    await User.aggregate[
      ({
        $match: { username: username?.toLowerCase() },
      },
      {
        $lookuo: {
          from: "Subscription",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },
      {
        $lookuo: {
          from: "Subscription",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo",
        },
      },
      {
        $addFields: {
          subscriberCount: {
            $size: "$subscribers",
          },
          subscribedToCount: {
            $size: "$subscribedTo",
          },
          isSubscribed: {
            $cond: {
              if: { $in: [req.user?._id, "$subscribers.subscriber"] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          fullname: 1,
          username: 1,
          email: 1,
          subscriberCount: 1,
          subscribedToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1,
        },
      })
    ];

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }

  console.log("Channel Details: ", channel);

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "Channel details fethched Succesfuuly")
    ); // aggregate returns an array thats why we can do indexing on channel
});

// Getting Watch History
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookuo: {
        from: "Video",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "User",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              ownner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History fetched Successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelDetails,
  getWatchHistory,
};
