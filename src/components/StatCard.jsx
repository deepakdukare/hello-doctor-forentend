import React from 'react';

const StatCard = ({ label, value, icon: Icon, color, bg, className = "stat-pill-premium" }) => {
    const iconStyle = {
        background: bg || `${color}15`,
        color: color
    };

    const iconClass = className === "stat-pill-premium" ? "stat-pill-icon" : "stat-pill-icon-v3";
    const contentClass = className === "stat-pill-premium" ? "stat-pill-content" : "stat-pill-content-v3";
    const valueClass = className === "stat-pill-premium" ? "stat-pill-value" : "stat-pill-value-v3";
    const labelClass = className === "stat-pill-premium" ? "stat-pill-label" : "stat-pill-label-v3";

    return (
        <div className={className}>
            <div className={iconClass} style={iconStyle}>
                <Icon size={18} />
            </div>
            <div className={contentClass}>
                <span className={valueClass}>{value}</span>
                <span className={labelClass}>{label}</span>
            </div>
        </div>
    );
};

export default StatCard;
