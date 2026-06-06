const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const User = require("./db/userModel.js");
const Photo = require("./db/photoModel.js");

const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.use(
  session({
    secret: "secret-key-cho-do-an-web",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "none",
      secure: true,
    },
  })
);

app.use("/images", express.static(path.join(__dirname, "images")));

mongoose
  .connect(
    "mongodb+srv://nguyenducmanhb23dcdt169_db_user:123@cluster0.pode3am.mongodb.net/thi?appName=Cluster0"
  )
  .then(() => {
    console.log("Đã kết nối thành công tới MongoDB Atlas!");
  })
  .catch((err) => {
    console.error("Lỗi kết nối MongoDB:", err);
  });

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const dir = "./images";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

app.use((req, res, next) => {
  req.session.userId = "57231f1a30e4351f4e9f4bd7";
  req.session.firstName = "Ian";
  next();
});

app.post("/commentsOfPhoto/:photo_id", async (req, res) => {
  try {
    const { comment } = req.body;
    const photoId = req.params.photo_id;

    if (!comment || comment.trim() === "") {
      return res.status(400).json({ message: "Bình luận không được để trống" });
    }

    if (!isValidObjectId(photoId)) {
      return res.status(400).json({ message: "ID ảnh không hợp lệ" });
    }

    const photo = await Photo.findById(photoId);
    if (!photo) return res.status(404).json({ message: "Không tìm thấy ảnh" });

    photo.comments.push({
      comment: comment,
      date_time: new Date(),
      user_id: req.session.userId,
    });

    await photo.save();
    res.status(200).json({ message: "Thêm bình luận thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server khi thêm bình luận" });
  }
});

app.post("/photos/new", upload.single("uploadedphoto"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Không có file nào được tải lên" });
    }

    const newPhoto = await Photo.create({
      file_name: req.file.filename,
      date_time: new Date(),
      user_id: req.session.userId,
      comments: [],
    });

    res
      .status(200)
      .json({ message: "Tải ảnh lên thành công", photo: newPhoto });
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server khi tải ảnh lên" });
  }
});

app.get("/user/list", async (req, res) => {
  try {
    const users = await User.find({}).select("_id first_name last_name");
    let usersList = JSON.parse(JSON.stringify(users));

    for (let i = 0; i < usersList.length; i++) {
      const userId = usersList[i]._id;
      usersList[i].photoCount = await Photo.countDocuments({ user_id: userId });
      const photosWithComments = await Photo.find({
        "comments.user_id": userId,
      });
      let commentCount = 0;
      photosWithComments.forEach((photo) => {
        photo.comments.forEach((comment) => {
          if (comment.user_id.toString() === userId.toString()) {
            commentCount++;
          }
        });
      });
      usersList[i].commentCount = commentCount;
    }
    res.status(200).json(usersList);
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server khi lấy danh sách user" });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id))
      return res.status(400).json({ message: "Định dạng ID không hợp lệ" });

    const user = await User.findById(id).select(
      "_id first_name last_name location description occupation"
    );
    if (!user)
      return res.status(400).json({ message: "Không tìm thấy người dùng" });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server khi lấy chi tiết user" });
  }
});

app.get("/photosOfUser/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id))
      return res.status(400).json({ message: "Định dạng ID không hợp lệ" });

    const userExists = await User.findById(id);
    if (!userExists)
      return res.status(400).json({ message: "Người dùng không tồn tại" });

    const photos = await Photo.find({ user_id: id })
      .select("_id user_id comments file_name date_time")
      .populate({
        path: "comments.user_id",
        select: "_id first_name last_name",
      });

    let shapedPhotos = JSON.parse(JSON.stringify(photos));
    shapedPhotos = shapedPhotos.map((photo) => {
      photo.comments.forEach((comment) => {
        if (comment.user_id) {
          comment.user = comment.user_id;
          delete comment.user_id;
        }
      });
      return photo;
    });

    res.status(200).json(shapedPhotos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi Server khi lấy danh sách ảnh" });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Backend Server đang chạy mượt mà tại cổng ${PORT}!`);
});
