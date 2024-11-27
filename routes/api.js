const express = require('express');
const router = express.Router();
const getPool = require('../config/database');
const { isAuthenticated } = require('../middleware/auth.middleware');


// ************************************************************
// ************************************************************
// ************ Displaying data for the pages *****************
// ************************************************************
// ************************************************************
    
// Get all businesses with price ranges
router.get('/getAllBusinesses', async (req, res) => {
    try {
        console.log('Attempting to fetch businesses from the database');
        const pool = await getPool();
        const [results] = await pool.query(`
            SELECT 
                b.business_id,
                b.businessName,
                b.businessType,
                b.category,
                b.businessLogo,
                b.location AS destination,
                b.pin_location,
                b.contactInfo,
                b.openingHours,
                b.facilities,
                b.policies,
                IF(
                    JSON_UNQUOTE(JSON_EXTRACT(b.businessCard, '$.description')) IS NULL OR 
                    JSON_UNQUOTE(JSON_EXTRACT(b.businessCard, '$.description')) = '', 
                    NULL, 
                    JSON_UNQUOTE(JSON_EXTRACT(b.businessCard, '$.description'))
                ) AS description,
                b.aboutUs,
                MIN(CAST(p.price AS DECIMAL)) AS lowest_price,
                MAX(CAST(p.price AS DECIMAL)) AS highest_price,
                AVG(r.ratings) AS rating,
                JSON_ARRAYAGG(JSON_UNQUOTE(JSON_EXTRACT(b.facilities, '$[*].name'))) AS raw_amenities
            FROM 
                businesses b
            LEFT JOIN 
                products p ON b.business_id = p.business_id
            LEFT JOIN
                business_ratings r ON b.business_id = r.business_id
            GROUP BY 
                b.business_id, b.businessName, b.businessType, b.businessLogo, 
                b.location, b.businessCard, b.aboutUs
            ORDER BY 
                b.business_id
        `);

        console.log('Businesses fetched successfully');

        // Post-process the results to clean up the unique_amenities
        const cleanedResults = results.map(business => {
            const uniqueAmenitiesSet = new Set();

            // Attempt to parse raw_amenities as JSON
            let rawAmenitiesArray;
            try {
                rawAmenitiesArray = JSON.parse(business.raw_amenities);
            } catch (e) {
                console.error('Error parsing raw_amenities:', e);
                rawAmenitiesArray = [];
            }

            // Ensure rawAmenitiesArray is an array before processing
            if (Array.isArray(rawAmenitiesArray)) {
                rawAmenitiesArray.forEach(amenity => {
                    if (amenity) {
                        try {
                            const amenitiesArray = JSON.parse(amenity);
                            amenitiesArray.forEach(item => uniqueAmenitiesSet.add(item));
                        } catch (e) {
                            console.error('Error parsing amenity:', e);
                        }
                    }
                });
            } else {
                console.warn('rawAmenitiesArray is not an array:', rawAmenitiesArray);
            }

            // Create a new object without raw_amenities
            const { raw_amenities, ...businessWithoutRaw } = business;

            return {
                ...businessWithoutRaw,
                amenities: Array.from(uniqueAmenitiesSet)
            };
        });

        res.json({
            success: true,
            businesses: cleanedResults,
            message: 'Businesses retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving businesses',
            error: error.message
        });
    }
});

// Get all business products
router.get('/getAllBusinessProduct', async (req, res) => {
    try {
        console.log('Attempting to fetch products from the database');
        const pool = await getPool();
        const [products] = await pool.query(`
            SELECT 
                products.*, 
                MAX(COALESCE(deals.discount, 0)) AS discount, 
                MAX(COALESCE(deals.expirationDate, 'No Expiration')) AS expiration
            FROM 
                products
            LEFT JOIN 
                deals 
            ON 
                products.product_id = deals.product_id
            GROUP BY 
                products.product_id
            ORDER BY 
                expiration DESC
            LIMIT 0, 1000
        `);
        console.log('Products fetched successfully');

        res.json({
            success: true,
            data: products,
            message: 'Products retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving products',
            error: error.message
        });
    }
});

// Endpoint to fetch all users
router.get('/superAdmin-fetchAllUsers', async (req, res) => {
  const sql = `
    SELECT 
      u.user_id,
      u.Fname,
      u.Lname,
      u.email,
      b.business_id,
      b.businessName,
      b.businessType
    FROM users u
    LEFT JOIN businesses b ON u.user_id = b.user_id
  `;

  try {
    const pool = await getPool();
    const [results] = await pool.query(sql);

    // Transform the results to include user type
    const formattedUsers = results.map(user => ({
      user_id: user.user_id,
      name: `${user.Fname} ${user.Lname}`,
      email: user.email,
      type: user.business_id ? 'Business Owner' : 'Tourist',
      // Include business details if they exist
      ...(user.business_id && {
        businessName: user.businessName,
        businessType: user.businessType
      })
    }));

    return res.json({ 
      success: true, 
      users: formattedUsers 
    });
  } catch (err) {
    console.error('Error executing SQL query:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router; 