import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { subscribe } from "diagnostics_channel";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //Get User Details
  //Validate if data is empty or not
  //Check if user already exists or not
  //Check for images , or Avatar
  //If images availble, send then to clodinary and check multer or clodinary if they successfullly got this
  //Register user in database
  //Remove Password nd refresh token from response
  //Check if user got registered nd if done then send response

  const { fullName, username, email, password } = req.body;
  console.log("Email Is: ", email);
  //This code checks if any feild provided by the frontend is empty or not , if empty returns error
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "fullName is Required");
  }
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  console.log(avatarLocalPath);
  // const coverImageLocalPath = req.files?.coverImage[0].path
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

//Login SetUp Now
const loginUser = asyncHandler(async (req, res) => {
  //Get username,Email Nd Password
  //Check if they already exist
  //if they do,Check the password .If matches then allow sign in
  // if they dont say sign up
  //If sign in then generate access & refresh token
  //Send them as cookie
  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or Email Is required");
  }
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (!user) {
    throw new ApiError(404, "User Does not exist");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

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
        "User logged In Successfully"
      )
    );
});

//Logging Out User
const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
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
    .json(new ApiResponse(200, {}, "User Logged Out Successfully"));
});

//Dekho frontEnd wala jb dubara accesstoken ki resquest marega to yahi deal krega
const refreshAccessToken = asyncHandler(async (req, res) => {
  //Ab accessToken milega kaha? so ye cookies me milega
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is Either expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async(req,res) =>{
  const {oldPassword, newPassword, confPassword} = req.body
  if (newPassword !== confPassword){
    throw new ApiError(401,"Passwords Do not match")
  }
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid Password")
  }
  user.password = newPassword
  await user.save({validateBeforeSave: false})
  return res.status(200).json(new ApiResponse(200,{},"Password is Changed"))
})

const getCurrentUser = asyncHandler( async(req, res) => {
  return res.status(200).json(200, req.user, "Current User Fetched Successfully")
})

//Name ya email vgehra update krne ke lie 
const updateAccountDetails = asyncHandler( async(req, res) => {
  const {fullName, email} = req.body
  if (!fullName || !email) {
    throw new ApiError(400,"Feilds are required")
  } 

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email
      }
    },
    {new: true} //Ye updated info return krta hai
  ).select("-password")
  return res.status(200).json(new ApiResponse(200, user,"Account Details Updated Successfully"))
})

const updateUserAvatar = asyncHandler( async(req, res)=>{
  const avatarLocalPath = req.file?.path
  if( !avatarLocalPath){
    throw new ApiError(400, "Avatar File is Missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  if(!avatar.url){
    throw new ApiError(400, "Error while uploading avatar")
  }
  const user = await User.findByIdAndUpdate(req.user?._id,
    {$set: {avatar}},
    {new: true}
  ).select("-password")
  return res.status(200).json(new ApiResponse(200, user, "Avatar Updated Successfully"))
})

const updateUserCoverImage = asyncHandler( async (req, res) =>{
  const coverImageLocalPath = req.file?.path
  if (!coverImageLocalPath){
    throw new ApiError(400,"No Cover Image Recieved")
  }
  const coverImage = await uploadOnCloudinary(avatarLocalPath)
  if(!coverImage.url){
    throw new ApiError(400, "Error while uploading avatar")
  }
  const user = await User.findByIdAndUpdate(req.user?._id,
    {$set: {coverImage}},
    {new: true}
  ).select("-password")
  return res.status(200).json(new ApiResponse(200, user, "Cover Image Updated Successfully"))
})

const getUserChannelProfile = asyncHandler(async(req, res)=>{
  const {username} = req.params
  if (!username?.trim()){
    throw new ApiError(400, "Username is missing")
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",   //Here it will look for all the channels that matches id nd will return as subscribers
        as: "subscribers"
      }
    },
    {
      $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",   //Here it will look for all the channels that matches id nd will return as subscribers
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelSubscribedToCounts: {
          $size: "subscribedTo"
        },
        isSubscribed:{
          $cond: {
            if:{$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelSubscribedToCounts: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1
      }
    }
  ])
  if (!channel?.length){
    throw new ApiError(404, " Channel does not exist")
  }
   return res.status(200).json(new ApiResponse(200,channel[0], "User Channel Fetched Successfully"))
}) 

const getWatchHistory = asyncHandler(async( req, res) =>{
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId.createFromHexString(req.user._id)
      }
    },{
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [{
                $project: {
                  fullName: 1,
                  username: 1,
                  avatar: 1
                }
              }]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner "
              }
            }
          }
        ]
      }
    }
  ])
  return res.status(200).json(new ApiResponse(200,user[0].watchHistory, "Watch History Fetched Successfully"))
})

export { registerUser, loginUser, logOutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory };
