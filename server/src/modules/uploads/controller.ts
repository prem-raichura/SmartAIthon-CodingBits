import type { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryConfigured, env } from '../../config/env.js';
import { AppError } from '../../middleware/error.js';
import { saveToDisk } from '../../lib/localStorage.js';

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

function uploadToCloudinary(buffer: Buffer, _mimetype: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'patrol-photos',
        resource_type: 'image',
        format: 'jpg',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');

    // Cloudinary when configured, otherwise local disk so the server works
    // with no cloud account (see lib/localStorage.ts).
    const url = cloudinaryConfigured
      ? await uploadToCloudinary(req.file.buffer, req.file.mimetype)
      : await saveToDisk(req.file.buffer, req.file.mimetype, `${req.protocol}://${req.get('host')}`);

    res.json({ url });
  } catch (err) {
    next(err);
  }
}
