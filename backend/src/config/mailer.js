import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.SMTP_PORT || 587);
const smtpPass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPass
  },
  tls: {
    rejectUnauthorized: true
  },
  requireTLS: port === 587
});
