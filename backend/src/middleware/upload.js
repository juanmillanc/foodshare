import multer from "multer";
import path from "path";
import fs from "fs";

const uploadFolder = path.resolve("uploads");
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadFolder),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Solo se permiten archivos PDF"));
  }
  cb(null, true);
};

export const uploadPdf = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});
