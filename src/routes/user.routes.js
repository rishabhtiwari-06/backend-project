import {Router} from "express";
import {registerUser} from "../controllers/user.controller.js"

const router = Router()

router.route("/register").post(registerUser)  //Jaise hi aap /user pe jaaoge vaise hi vo userrouter pe bhejega fir ye userrouter use /register pe bhejega

export default router