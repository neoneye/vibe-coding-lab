# 1927 Solvay Conference — Interactive Photo

Standalone HTML page showing the famous 1927 Solvay Conference group photo with clickable circles over each of the 29 attendees, linking to their Wikipedia pages.

## Known Issue

The circle x,y coordinates do not accurately align with the faces in the photo. The circles are placed near — but not on — the actual heads. This affects all three rows (back, middle, front) to varying degrees.

The Haar cascade face detector (OpenCV) struggled with this 1927 black-and-white image. It detected suit jackets/chests instead of faces for the front row, completely missed the small back-row faces, and produced a mix of back-row and middle-row detections. Multiple detectors were tried (Haar, OpenCV DNN, MediaPipe, template matching) — none reliably detected all 29 faces.

## Suggested Fixes

1. **Manual annotation tool** — Add a drag-and-drop editor mode to the page itself. Let the user click on each face to set its position directly in the browser, then export the coordinates as JSON. This avoids the detection problem entirely.

2. **Use a modern face detector via API** — Send the image to a cloud vision API (e.g. Google Cloud Vision, AWS Rekognition, or Azure Face API) that uses deep learning models trained on diverse datasets including historical photos. These handle B&W group photos far better than local Haar/DNN detectors.

3. **Use a pre-annotated dataset** — The Solvay Conference photo is one of the most famous photos in physics. Search for existing annotated versions with known face bounding boxes (e.g. from Wikimedia Commons metadata, academic papers, or open datasets) rather than re-detecting from scratch.

4. **Use dlib's HOG or CNN face detector** — Install dlib (which requires CMake to build) and use its HOG-based or CNN-based face detector. These are significantly more robust than OpenCV's Haar cascades for challenging images, though they still may struggle with the smallest back-row faces.

5. **Hybrid browser-based approach** — Use the JavaScript `FaceDetector` API (available in Chrome) or a client-side ML model like `face-api.js` (built on TensorFlow.js) to detect faces directly in the browser at runtime. The detected positions can be used as initial values, with the user fine-tuning any misplacements interactively.
