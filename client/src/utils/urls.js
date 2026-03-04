import api from '../api';

/**
 * Generates a full URL for a given path, pointing to the backend server.
 * Handles:
 * 1. Already absolute URLs (startsWith http)
 * 2. Relative paths (prepends backend base URL)
 * 3. Cleaning up double slashes
 * @param {string} path - The path to the file (e.g., 'uploads/file.pdf')
 * @returns {string} - The full URL to the file
 */
export const getFullUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // Get base URL from axios instance
    // baseURL is usually something like 'https://api.example.com/api' or '/api'
    let baseUrl = api.defaults.baseURL || '';

    // Remove the '/api' suffix to get the root of the server
    baseUrl = baseUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');

    let generatedUrl = '';
    if (!baseUrl || baseUrl === '/') {
        generatedUrl = path.startsWith('/') ? path : `/${path}`;
    } else {
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        generatedUrl = `${cleanBase}/${cleanPath}`;
    }

    console.log("[urls.js] getFullUrl debug:", {
        inputPath: path,
        axiosBaseUrl: api.defaults.baseURL,
        resolvedBaseUrl: baseUrl,
        finalUrl: generatedUrl
    });

    return generatedUrl;
};
