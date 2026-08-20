// middleware/upload.js
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

module.exports = multer({ 
  storage,
  fileFilter,
  // A 20 lakh-row CSV can be hundreds of megabytes. Keep the upload on disk,
  // rather than in process memory, and cap it to a deliberately generous size.
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1 GB
  }
});
