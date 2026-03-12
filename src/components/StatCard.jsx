import React from 'react';

/**
 * Modern StatCard v4
 * Supports horizontal layout, icons with translucent backgrounds, and trend indicators.
 */
const StatCard = ({ label, title, value, icon: Icon, color, loading, trend, className = "" }) => {
    // Label can be passed as 'label' or 'title' for backward compatibility
    const displayLabel = label || title;
    
    let trendColor = '#3b82f6'; // neutral blue
    if (trend > 0) trendColor = '#10b981'; // green
    else if (trend < 0) trendColor = '#ef4444'; // red

    return (
        <div className={`stat-card-v4 ${className}`}>
            <div className="stat-icon-v4" style={{ backgroundColor: `${color}15`, color: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-info-v4">
                <span className="stat-label-v4">{displayLabel}</span>
                <div className="stat-value-v4">
                    {loading ? (
                        <div className="skeleton-pulse" style={{ height: '32px', width: '60px', borderRadius: '6px' }}></div>
                    ) : (
                        value
                    )}
                </div>
                {trend !== undefined && (
                    <div className="stat-trend-v4" style={{ color: trendColor }}>
                        {trend > 0 ? '+' : ''}{trend}% in last 7 days
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
