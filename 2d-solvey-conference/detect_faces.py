"""
Draw the known Haar detections on the grid image so we can precisely
measure the remaining undetected faces (back row + 2 missing middle row).
"""
import cv2
import numpy as np

img = cv2.imread("/tmp/solvay1927.jpg")
h, w = img.shape[:2]

# Known good detections from Haar cascade
front = [
    {"cx":6.1,"cy":49.9,"r":1.7}, {"cx":14.9,"cy":49.9,"r":2.1},
    {"cx":25.4,"cy":50.6,"r":1.8}, {"cx":36.5,"cy":50.5,"r":2.1},
    {"cx":48.4,"cy":49.6,"r":1.7}, {"cx":57.1,"cy":49.9,"r":1.7},
    {"cx":66.3,"cy":50.8,"r":1.9}, {"cx":77.3,"cy":51.2,"r":2.0},
    {"cx":87.2,"cy":51.8,"r":1.9},
]
middle_detected = [
    {"cx":24.2,"cy":40.5,"r":1.5}, {"cx":29.4,"cy":43.4,"r":1.7},
    {"cx":37.7,"cy":42.9,"r":1.7}, {"cx":46.8,"cy":43.7,"r":1.7},
    {"cx":54.3,"cy":41.4,"r":1.6}, {"cx":62.8,"cy":41.7,"r":1.7},
    {"cx":70.7,"cy":41.4,"r":1.8},
]

# Create annotated grid images for each row to measure missing faces
def make_grid(y_start_pct, y_end_pct, detections, name, det_color=(0,0,255)):
    y1 = int(y_start_pct/100*h); y2 = int(y_end_pct/100*h)
    crop = img[y1:y2, :].copy()
    ch = crop.shape[0]

    # 1% grid lines
    for pct in range(0, 101):
        x = int(pct/100*w)
        if pct % 5 == 0:
            cv2.line(crop, (x,0), (x,ch), (0,255,0), 1)
            cv2.putText(crop, f"{pct}", (x+2,16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)
        else:
            cv2.line(crop, (x,0), (x,8), (0,150,0), 1)

    for pct in range(0, 101):
        y = int(pct/100*h) - y1
        if 0 <= y < ch:
            if pct % 5 == 0:
                cv2.line(crop, (0,y), (w,y), (0,255,0), 1)
                cv2.putText(crop, f"{pct}", (2,y-3), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)
            else:
                cv2.line(crop, (0,y), (w,y), (0,100,0), 1)
                cv2.putText(crop, f"{pct}", (2,y-2), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0,140,0), 1)

    # Draw known detections
    for f in detections:
        px = int(f["cx"]/100*w)
        py = int(f["cy"]/100*h) - y1
        pr = int(f["r"]/100*w)
        if 0 <= py < ch:
            cv2.circle(crop, (px, py), pr, det_color, 2)

    # Also draw front row positions as reference (thin vertical lines)
    for f in front:
        x = int(f["cx"]/100*w)
        cv2.line(crop, (x, 0), (x, ch), (100,100,255), 1)

    cv2.imwrite(f"/tmp/solvay_grid_{name}.jpg", crop)
    print(f"  {name}: /tmp/solvay_grid_{name}.jpg")

print("Generating annotated grid images...")
make_grid(28, 42, [], "back_row")
make_grid(37, 48, middle_detected, "middle_row")
make_grid(46, 55, front, "front_row")
