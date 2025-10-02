import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary when needed
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

/**
 * Uploads a file to Cloudinary
 * @param file - The file buffer or stream to upload
 * @param folder - The folder in Cloudinary to upload to
 * @param publicId - Optional custom public ID for the uploaded file
 * @returns Promise with the upload result
 */
export const uploadToCloudinary = async (
  file: Buffer | Readable,
  folder: string = 'products',
  publicId?: string
): Promise<{ url: string; publicId: string }> => {
  // Configure Cloudinary before use
  configureCloudinary();
  
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder,
      overwrite: false,
      resource_type: 'image',
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Upload failed'));
        }
      }
    );

    if (file instanceof Buffer) {
      uploadStream.end(file);
    } else if (file instanceof Readable) {
      file.pipe(uploadStream);
    } else {
      reject(new Error('Invalid file type'));
    }
  });
};

/**
 * Deletes a file from Cloudinary
 * @param publicId - The public ID of the file to delete
 * @returns Promise with the deletion result
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  // Configure Cloudinary before use
  configureCloudinary();
  
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Uploads multiple files to Cloudinary with folder structure: vendorId/productId
 * @param files - Array of file objects from express-fileupload
 * @param vendorId - Vendor ID for folder structure
 * @param productId - Product ID for folder structure
 * @returns Promise with array of upload results
 */
export const uploadProductImages = async (
  files: any[],
  vendorId: string,
  productId: string
): Promise<{ url: string; publicId: string; alt?: string }[]> => {
  // Create folder path: vendorId/productId
  const folderPath = `products/${vendorId}/${productId}`;
  
  const uploadPromises = files.map(async (file) => {
    // Upload each file to the specific folder
    const result = await uploadToCloudinary(file.data, folderPath);
    
    return {
      url: result.url,
      publicId: result.publicId,
      alt: file.name || 'Product image'
    };
  });
  
  return Promise.all(uploadPromises);
};

/**
 * Uploads multiple files to Cloudinary
 * @param files - Array of file buffers or streams to upload
 * @param folder - The folder in Cloudinary to upload to
 * @returns Promise with array of upload results
 */
export const uploadMultipleToCloudinary = async (
  files: (Buffer | Readable)[],
  folder: string = 'products'
): Promise<{ url: string; publicId: string }[]> => {
  const uploadPromises = files.map((file) => uploadToCloudinary(file, folder));
  return Promise.all(uploadPromises);
};

export default cloudinary;