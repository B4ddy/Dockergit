import React, { useEffect, useRef } from "react";

function Motion({ actualPosition }) {
  const canvasRef = useRef(null);
  
  // Normalize the position to 0-360
  const normalizedRotation = (((actualPosition % 1000) / 1000) * 360)+3509;
  const initialAngle = (normalizedRotation * Math.PI) / 180; // Convert to radians

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    
    resizeCanvas();
    
    // Fixed blue anchor point
    const bluePoint = { 
      x: canvas.width / 3.7, 
      y: canvas.height / 3 
    };
    
    // Circle properties
    const circleCenter = { 
      x: (canvas.width / 2.8) * 2, 
      y: canvas.height / 1.4
    };
    const circleRadius = 18;
    
    // Bar properties
    const bar1Length = 90; // Fixed length of first bar (blue to joint)
    const bar2Length = 115; // Fixed length of second bar (joint to red)
    
    // Red point and joint point
    let redPoint = { x: 0, y: 0 };
    let jointPoint = { x: 0, y: 0 };
    let angle = initialAngle;
    
    // Calculate joint position using inverse kinematics
    function calculateIK() {
      // Update red point position (rotating around circle)
      redPoint.x = circleCenter.x + circleRadius * Math.cos(angle);
      redPoint.y = circleCenter.y + circleRadius * Math.sin(angle);
      
      // Calculate distance between blue and red points
      const dx = redPoint.x - bluePoint.x;
      const dy = redPoint.y - bluePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if points are too far apart or too close
      const maxDist = bar1Length + bar2Length;
      const minDist = Math.abs(bar1Length - bar2Length);
      
      if (distance > maxDist) {
        // Points too far apart - extend in line
        const ratio = bar1Length / maxDist;
        jointPoint.x = bluePoint.x + dx * ratio;
        jointPoint.y = bluePoint.y + dy * ratio;
      } else if (distance < minDist) {
        // Points too close - place joint perpendicular to line
        const midX = (bluePoint.x + redPoint.x) / 2;
        const midY = (bluePoint.y + redPoint.y) / 2;
        
        // Perpendicular direction
        const perpX = -dy;
        const perpY = dx;
        
        // Normalize and scale
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        const h = Math.sqrt(bar1Length * bar1Length - (distance / 2) * (distance / 2));
        
        jointPoint.x = midX + (perpX / perpLength) * h;
        jointPoint.y = midY + (perpY / perpLength) * h;
      } else {
        // Valid configuration - use Law of Cosines
        const a = ((bar1Length * bar1Length) - (bar2Length * bar2Length) + (distance * distance)) / (2 * distance);
        
        // Distance from bluePoint to joint along the line
        const h = Math.sqrt(bar1Length * bar1Length - a * a);
        
        // Find point along the line at distance a from bluePoint
        const pointOnLine = {
          x: bluePoint.x + (dx * a / distance),
          y: bluePoint.y + (dy * a / distance)
        };
        
        // Find joint by moving perpendicular to the line
        const perpX = -dy / distance;
        const perpY = dx / distance;
        
        jointPoint.x = pointOnLine.x + perpX * h;
        jointPoint.y = pointOnLine.y + perpY * h;
      }
    }
    
    // Draw function
    function draw() {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate joint position
      calculateIK();
      
      // Draw circle
      ctx.beginPath();
      ctx.arc(circleCenter.x, circleCenter.y, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw bars
      // First bar (blue point to joint)
      ctx.beginPath();
      ctx.moveTo(bluePoint.x, bluePoint.y);
      ctx.lineTo(jointPoint.x, jointPoint.y);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Second bar (joint to red point)
      ctx.beginPath();
      ctx.moveTo(jointPoint.x, jointPoint.y);
      ctx.lineTo(redPoint.x, redPoint.y);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Draw joint
      ctx.beginPath();
      ctx.arc(jointPoint.x, jointPoint.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      
      // Draw blue anchor point
      ctx.beginPath();
      ctx.arc(bluePoint.x, bluePoint.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#6391c0';
      ctx.fill();
      
      // Draw red rotating point
      ctx.beginPath();
      ctx.arc(redPoint.x, redPoint.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#6391c0';
      ctx.fill();
    }
    
    // Draw once
    draw();
  }, [actualPosition, normalizedRotation]);

  return (
    <div style={{ position: 'relative', width: '250px', height: '175px'}}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%' 
        }}
      />
    </div>
  );
}

export default Motion;