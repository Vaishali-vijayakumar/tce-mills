const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// ─── Supabase Admin Client (uses service_role key to bypass RLS) ─────────────
// Add SUPABASE_SERVICE_KEY to your Render environment variables.
// Get it from: Supabase Dashboard → Project Settings → API → service_role key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_KEY;

// Use service role key if available, fall back to anon key
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: { persistSession: false }
});

const BUCKET = 'documents';

if (!supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_SERVICE_KEY not set. Add it to Render env vars for file uploads to work.');
}

// ─── Multer: memory storage (no local disk) ───────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed.'), false);
        }
    }
});

// ─── POST /api/upload ─────────────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    const storagePath = `uploads/${filename}`;

    try {
        // Upload buffer directly to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, req.file.buffer, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError.message);
            return res.status(500).json({
                message: 'File upload to cloud storage failed: ' + uploadError.message
            });
        }

        // Get permanent public URL
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        return res.json({
            message: 'File uploaded successfully.',
            filePath: data.publicUrl,
            originalName: req.file.originalname
        });

    } catch (err) {
        console.error('Upload route error:', err.message);
        return res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

module.exports = router;
