import dotenv from 'dotenv';
dotenv.config();
import multer from "multer";
import { v2 as cloudinary } from 'cloudinary';
import { ALLOWED_MEDIA_TYPES, MAX_FILE_SIZE } from '../constants/constant.js';
import { SUCCESS, ERROR } from '../constants/error.js';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage for multer
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// Upload to Cloudinary using buffer
export const __upload_to_cloudinary = (fileBuffer, fileName) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', public_id: fileName },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
};

const __create_unique_filename = (originalName) => {
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${timestamp}_${sanitizedName}`;
};

const __validate_file = (file) => {
    if (!file) {
        return res.status(400).json({
            success: false,
            message: ERROR.ERROR_NO_FILE_UPLOADED,
        });
    }
    if (!ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
        return res.status(400).json({
            success: false,
            message: ERROR.ERROR_INVALID_FILE_TYPE,
        });
    }
    if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({
            success: false,
            message: ERROR.ERROR_FILE_TOO_LARGE,
        });
    }
    return true;
};

export const uploadHelperFunction = async (req, res) => {
    try {   
        if (!__validate_file(req.file)) {
            return res.status(400).json({
                success: false,
                message: ERROR.ERROR_INVALID_FILE,
            });
        }

        const uniqueFileName = __create_unique_filename(req.file.originalname);

        const cloudinaryUrl = await __upload_to_cloudinary(req.file.buffer, uniqueFileName);

        res.status(200).json({
            success: true,
            message: SUCCESS.SUCCESS_FULL_UPLOAD,
            data: {
                filepath: cloudinaryUrl,
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error("----------ERROR WHILE UPLOADING SINGLE FILE----------", error);
        res.status(500).json({ 
            success: false,
            message: ERROR.INTERNAL_SERVER_ERROR,
        });
    }
};

export const uploadMultipleHelperFunction = async (req, res) => {
    try {
        const files = req.files;
        const fileUrls = [];
        for (const file of files) {
            if (!__validate_file(file)) {
                return res.status(400).json({
                    success: false,
                    message: ERROR.ERROR_INVALID_FILE,
                });
            }
            const uniqueFileName = __create_unique_filename(file.originalname);
            const cloudinaryUrl = await __upload_to_cloudinary(file.buffer, uniqueFileName);
            fileUrls.push(cloudinaryUrl);
        }
        res.status(200).json({
            success: true,
            message: SUCCESS.SUCCESS_FULL_UPLOAD,
            data: fileUrls,
        });
    } catch (error) {
        console.error("----------ERROR WHILE UPLOADING MULTIPLE FILES----------", error);
        res.status(500).json({
            success: false,
            message: ERROR.INTERNAL_SERVER_ERROR,
        });
    }
};