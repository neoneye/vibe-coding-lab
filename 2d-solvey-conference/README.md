# 1927 Solvay Conference — Interactive Photo

Standalone HTML page showing the famous 1927 Solvay Conference group photo with clickable circles over each of the 29 attendees, linking to their Wikipedia pages.

## Face detection

`detect_faces.py` detects all 29 faces using OpenCV's YuNet DNN detector (`cv2.FaceDetectorYN`), which handles this 1927 B&W group photo where Haar cascades failed. It downloads the photo and the YuNet ONNX model to `/tmp` on first run, clusters the detections into the three known rows, matches them left-to-right to the attendee names, and prints the coordinate block used in `index.html` plus a labeled debug image at `/tmp/solvay_faces_debug.jpg`.

```sh
venv/bin/python detect_faces.py
```
