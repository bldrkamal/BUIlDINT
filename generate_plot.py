
import matplotlib.pyplot as plt
import numpy as np

def calculate_overlap(theta_deg, thickness=0.225, height=3.0):
    # Avoid division by zero
    if theta_deg < 0.1: return float('inf')
    
    theta_rad = np.radians(theta_deg)
    # V = t^2 * h / sin(theta)
    return (thickness**2 * height) / np.sin(theta_rad)

# Data
angles = np.linspace(1, 90, 500)
volumes = [calculate_overlap(a) for a in angles]

# Plot
plt.figure(figsize=(10, 6))
plt.plot(angles, volumes, label=r'Overlap Volume $V = \frac{t^2 h}{\sin(\theta)}$', color='blue', linewidth=2)

# Threshold Line
plt.axvline(x=15, color='red', linestyle='--', label=r'Threshold $\theta_{min} = 15^{\circ}$')

# Annotations
plt.title('Sensitivity Analysis: Overlap Volume vs. Intersection Angle', fontsize=14)
plt.xlabel('Intersection Angle (degrees)', fontsize=12)
plt.ylabel('Overlap Volume ($m^3$)', fontsize=12)
plt.legend()
plt.grid(True, which='both', linestyle='--', alpha=0.7)

# Limit Y axis to show the "elbow" clearly (ignore infinity)
plt.ylim(0, 1.0) 
plt.xlim(0, 90)

# Save
plt.savefig('sensitivity.png', dpi=300)
print("Plot saved to sensitivity.png")
