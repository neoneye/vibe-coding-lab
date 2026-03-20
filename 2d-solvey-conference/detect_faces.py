"""Verify the updated coordinates."""
import cv2

img = cv2.imread("/tmp/solvay1927.jpg")
h, w = img.shape[:2]
debug = img.copy()

people = [
    # Back row - grid measured
    ("1 Piccard",      7.0, 32.5, 1.5, (0,255,0)),
    ("2 Henriot",     13.0, 35.5, 1.5, (0,255,0)),
    ("3 Ehrenfest",   18.0, 34.0, 1.5, (0,255,0)),
    ("4 Herzen",      23.0, 36.5, 1.5, (0,255,0)),
    ("5 deDonder",    29.0, 35.0, 1.5, (0,255,0)),
    ("6 Schrodinger", 35.0, 35.0, 1.5, (0,255,0)),
    ("7 Verschfflt",  41.0, 33.5, 1.5, (0,255,0)),
    ("8 Pauli",       48.0, 36.0, 1.5, (0,255,0)),
    ("9 Heisenberg",  54.0, 34.0, 1.5, (0,255,0)),
    ("10 Fowler",     60.5, 36.0, 1.5, (0,255,0)),
    ("11 Brillouin",  66.5, 34.0, 1.5, (0,255,0)),
    # Middle row - aligned with front row x-positions
    ("12 Debye",       6.0, 43.0, 1.8, (255,200,0)),
    ("13 Knudsen",    15.0, 42.5, 1.8, (255,200,0)),
    ("14 Bragg",      25.5, 42.0, 1.8, (255,200,0)),
    ("15 Kramers",    36.5, 42.5, 1.8, (255,200,0)),
    ("16 Dirac",      48.0, 42.0, 1.8, (255,200,0)),
    ("17 Compton",    57.0, 42.0, 1.8, (255,200,0)),
    ("18 deBroglie",  66.5, 42.0, 1.8, (255,200,0)),
    ("19 Born",       77.0, 42.0, 1.8, (255,200,0)),
    ("20 Bohr",       87.0, 42.0, 1.8, (255,200,0)),
    # Front row - exact Haar detections
    ("21 Langmuir",    6.1, 49.9, 1.7, (0,150,255)),
    ("22 Planck",     14.9, 49.9, 2.1, (0,150,255)),
    ("23 Curie",      25.4, 50.6, 1.8, (0,150,255)),
    ("24 Lorentz",    36.5, 50.5, 2.1, (0,150,255)),
    ("25 Einstein",   48.4, 49.6, 1.7, (0,150,255)),
    ("26 Langevin",   57.1, 49.9, 1.7, (0,150,255)),
    ("27 Guye",       66.3, 50.8, 1.9, (0,150,255)),
    ("28 Wilson",     77.3, 51.2, 2.0, (0,150,255)),
    ("29 Richardson", 87.2, 51.8, 1.9, (0,150,255)),
]

for label, cx, cy, r, color in people:
    px = int(cx / 100 * w)
    py = int(cy / 100 * h)
    pr = max(int(r / 100 * w), 25)
    cv2.circle(debug, (px, py), pr, color, 2)
    cv2.putText(debug, label, (px - 30, py - pr - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255,255,255), 2)
    cv2.putText(debug, label, (px - 30, py - pr - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1)

cv2.imwrite("/tmp/solvay_verify2.jpg", debug)
print("Verification: /tmp/solvay_verify2.jpg")
