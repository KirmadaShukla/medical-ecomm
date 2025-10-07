import { Request, Response } from 'express';
import Banner from '../models/banner';
import { uploadProductImages, deleteFromCloudinary } from '../utils/cloudinary';
import mongoose from 'mongoose';

// Get all banners
export const getBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    
    // Build filter
    const filter: any = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sort: { sortOrder: 1, createdAt: -1 }
    };
    
    const result = await (Banner as any).paginate(filter, options);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ message: 'Error fetching banners', error: error.message });
  }
};

// Get banner by ID
export const getBannerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    
    res.status(200).json(banner);
  } catch (error: any) {
    console.error('Error fetching banner:', error);
    res.status(500).json({ message: 'Error fetching banner', error: error.message });
  }
};

// Create banner
export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, link, isActive, sortOrder, startDate, endDate } = req.body;
    
    // Handle image upload
    let processedImage: { url: string; publicId: string; alt?: string } | null = null;
    
    if (req.files && req.files.image) {
      const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
      const processedImages = await uploadProductImages(filesArray, req.user?._id, 'banners');
      processedImage = processedImages[0] || null;
    } else if (req.body.image) {
      // Handle existing image URL
      const image = req.body.image;
      if (typeof image === 'string') {
        processedImage = {
          url: image,
          publicId: 'default_public_id',
          alt: title || 'Banner image'
        };
      } else if (typeof image === 'object' && image.url) {
        processedImage = {
          url: image.url,
          publicId: image.publicId || 'default_public_id',
          alt: image.alt || title || 'Banner image'
        };
      }
    }
    
    if (!processedImage) {
      res.status(400).json({ message: 'Banner image is required' });
      return;
    }
    
    const banner = new Banner({
      title,
      description,
      image: processedImage,
      link,
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    
    await banner.save();
    
    res.status(201).json({
      message: 'Banner created successfully',
      banner
    });
  } catch (error: any) {
    console.error('Error creating banner:', error);
    res.status(500).json({ message: 'Error creating banner', error: error.message });
  }
};

// Update banner
export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, link, isActive, sortOrder, startDate, endDate } = req.body;
    
    const updateFields: any = {};
    
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (link !== undefined) updateFields.link = link;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (sortOrder !== undefined) updateFields.sortOrder = sortOrder;
    if (startDate !== undefined) updateFields.startDate = new Date(startDate);
    if (endDate !== undefined) updateFields.endDate = new Date(endDate);
    
    // Handle image update
    if (req.files && req.files.image) {
      const filesArray = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
      const processedImages = await uploadProductImages(filesArray, req.user?._id, 'banners');
      const processedImage = processedImages[0] || null;
      
      if (processedImage) {
        // Delete old image from Cloudinary
        const oldBanner = await Banner.findById(id);
        if (oldBanner && oldBanner.image.publicId) {
          try {
            await deleteFromCloudinary(oldBanner.image.publicId);
          } catch (error) {
            console.error('Error deleting old image from Cloudinary:', error);
          }
        }
        
        updateFields.image = processedImage;
      }
    } else if (req.body.image) {
      // Handle existing image URL
      const image = req.body.image;
      if (typeof image === 'string') {
        updateFields.image = {
          url: image,
          publicId: 'default_public_id',
          alt: title || 'Banner image'
        };
      } else if (typeof image === 'object' && image.url) {
        updateFields.image = {
          url: image.url,
          publicId: image.publicId || 'default_public_id',
          alt: image.alt || title || 'Banner image'
        };
      }
    }
    
    const banner = await Banner.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    
    res.status(200).json({
      message: 'Banner updated successfully',
      banner
    });
  } catch (error: any) {
    console.error('Error updating banner:', error);
    res.status(500).json({ message: 'Error updating banner', error: error.message });
  }
};

// Delete banner
export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    
    // Delete image from Cloudinary
    if (banner.image.publicId) {
      try {
        await deleteFromCloudinary(banner.image.publicId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }
    
    await Banner.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Banner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ message: 'Error deleting banner', error: error.message });
  }
};

// Get active banners for frontend
export const getActiveBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    
    const banners = await Banner.find({
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ]
        }
      ]
    }).sort({ sortOrder: 1, createdAt: -1 });
    
    res.status(200).json(banners);
  } catch (error: any) {
    console.error('Error fetching active banners:', error);
    res.status(500).json({ message: 'Error fetching active banners', error: error.message });
  }
};