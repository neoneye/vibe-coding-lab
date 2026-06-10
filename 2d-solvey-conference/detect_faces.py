"""Detect the 29 faces in the 1927 Solvay Conference photo with YuNet.

Uses OpenCV's FaceDetectorYN (YuNet, a DNN detector) which — unlike the Haar
cascades previously tried — finds all 29 faces in this B&W group photo.

Detections are clustered into the three known rows (back 11, middle 9,
front 9) via the two largest gaps in face-center y, then sorted
left-to-right and matched to the attendee names.

Outputs:
  - the people coordinate block (cx/cy/r as % like index.html uses) on stdout
  - /tmp/solvay_faces_debug.jpg with labeled circles for visual verification

The photo and the YuNet model are downloaded to /tmp on first run.
"""
import os
import sys
import urllib.request

import cv2

IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/6/6e/Solvay_conference_1927.jpg"
MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
IMAGE_PATH = "/tmp/solvay1927.jpg"
MODEL_PATH = "/tmp/face_detection_yunet_2023mar.onnx"
DEBUG_PATH = "/tmp/solvay_faces_debug.jpg"

SCORE_THRESHOLD = 0.7  # real faces score >= 0.85; wall false positive ~0.5

# Left-to-right per row, the canonical attendee ordering.
ROWS = [
    ("back", ["Piccard", "Henriot", "Ehrenfest", "Herzen", "de Donder",
              "Schrödinger", "Verschaffelt", "Pauli", "Heisenberg",
              "Fowler", "Brillouin"]),
    ("middle", ["Debye", "Knudsen", "Bragg", "Kramers", "Dirac",
                "Compton", "de Broglie", "Born", "Bohr"]),
    ("front", ["Langmuir", "Planck", "Curie", "Lorentz", "Einstein",
               "Langevin", "Guye", "Wilson", "Richardson"]),
]
ROW_COLORS = {"back": (0, 255, 0), "middle": (255, 200, 0), "front": (0, 150, 255)}


def fetch(url, path):
    if not os.path.exists(path):
        print(f"Downloading {url} -> {path}", file=sys.stderr)
        req = urllib.request.Request(url, headers={"User-Agent": "vibe-coding-lab/1.0"})
        with urllib.request.urlopen(req) as r, open(path, "wb") as f:
            f.write(r.read())


def detect_faces(img):
    h, w = img.shape[:2]
    detector = cv2.FaceDetectorYN.create(
        MODEL_PATH, "", (w, h),
        score_threshold=SCORE_THRESHOLD, nms_threshold=0.3, top_k=5000)
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    if faces is None:
        sys.exit("No faces detected")
    # (cx, cy, half-size) in pixels per face
    return [(x + fw / 2, y + fh / 2, max(fw, fh) / 2)
            for x, y, fw, fh in (f[:4] for f in faces)]


def split_rows(faces, img_h):
    """Split into back/middle/front rows by center y, using the known row sizes."""
    expected = sum(len(names) for _, names in ROWS)
    if len(faces) != expected:
        sys.exit(f"Expected {expected} faces, got {len(faces)} — "
                 f"adjust SCORE_THRESHOLD or inspect {DEBUG_PATH}")
    by_y = sorted(faces, key=lambda f: f[1])
    start = 0
    for row, names in ROWS:
        band, start = by_y[start:start + len(names)], start + len(names)
        if start < len(by_y) and by_y[start][1] - band[-1][1] < 0.02 * img_h:
            sys.exit(f"Rows '{row}' and the next overlap in y — "
                     f"clustering unreliable, inspect {DEBUG_PATH}")
        yield row, [(name, *face) for name, face
                    in zip(names, sorted(band, key=lambda f: f[0]))]


def main():
    fetch(IMAGE_URL, IMAGE_PATH)
    fetch(MODEL_URL, MODEL_PATH)
    img = cv2.imread(IMAGE_PATH)
    h, w = img.shape[:2]

    debug = img.copy()
    print("// cx, cy = head center as % of image width/height; r = radius as % of width")
    for row, members in split_rows(detect_faces(img), h):
        print(f"// {row} row")
        for name, cx, cy, half in members:
            r = half * 1.25  # margin so the circle covers hair/hat, not just the face
            print(f'  {{ name: "{name}", row: "{row}", '
                  f"cx: {cx / w * 100:.1f}, cy: {cy / h * 100:.1f}, "
                  f"r: {r / w * 100:.2f} }},")
            color = ROW_COLORS[row]
            cv2.circle(debug, (int(cx), int(cy)), int(r), color, 3)
            cv2.putText(debug, name, (int(cx - r), int(cy - r) - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 4)
            cv2.putText(debug, name, (int(cx - r), int(cy - r) - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

    cv2.imwrite(DEBUG_PATH, debug)
    print(f"Debug image: {DEBUG_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
