module.exports = (err, req, res, next) => {
    console.error('[Error Stack]:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal System Error Encountered'
    });
};