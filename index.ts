import dotenv from "dotenv";
dotenv.config();
import mainFunction, { main2 } from "./main";
process.env.FUN === "MAIN2" ? main2() : mainFunction();
