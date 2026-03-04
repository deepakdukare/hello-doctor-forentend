import React from 'react';

const StatCard = ({ label, value, icon: Icon, color, bg, className = "stat-pill-premium", style = {} }) => {
    const iconStyle = {
        background: bg || `${color}15`,
        color: color,
        ...(style.iconSize && { width: style.iconSize, height: style.iconSize })
    };

    const iconClass = className === "stat-pill-premium" ? "stat-pill-icon" : "stat-pill-icon-v3";
    const contentClass = className === "stat-pill-premium" ? "stat-pill-content" : "stat-pill-content-v3";
    const valueClass = className === "stat-pill-premium" ? "stat-pill-value" : "stat-pill-value-v3";
    const labelClass = className === "stat-pill-premium" ? "stat-pill-label" : "stat-pill-label-v3";

    const iconSize = style.iconSize ? parseInt(style.iconSize) : 18;

    return (
        <div className={className} style={style}>
            <div className={iconClass} style={iconStyle}>
                <Icon size={iconSize} />
            </div>
            <div className={contentClass} style={style.valueStyle ? { ...contentClass === "stat-pill-content-v3" ? { display: 'flex', flexDirection: 'column' } : {}, ...style.valueStyle } : undefined}>
                <span className={valueClass} style={style.valueStyle ? { fontSize: style.valueStyle?.fontSize || '1.25rem' } : undefined}>{value}</span>
                <span className={labelClass} style={style.labelStyle ? { fontSize: style.labelStyle?.fontSize || '0.75rem' } : undefined}>{label}</span>
            </div>
        </div>
    );
};

export default StatCard;
