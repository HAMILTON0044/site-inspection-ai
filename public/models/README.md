# Construction PPE YOLOv8n model

- Runtime file: `construction-ppe-yolov8n.onnx`
- Architecture: YOLOv8n object detection
- Input: `1 × 3 × 640 × 640`
- Output: `1 × 14 × 8400`
- Source repository: <https://github.com/snehilsanyal/Construction-Site-Safety-PPE-Detection>
- Source weight: `models/best.pt`
- Source weight SHA-256: `4D07BBD92CA30D5C12DD67CCF52B2F54F533C9CCFEF534284124682EF9F56129`
- Exported ONNX SHA-256: `BA2C398391A4BC51C3813485A1BF122FDEC08CB0D7873B602A45ABB603CABD74`
- Export tool: Ultralytics 8.4.159, ONNX opset 17

Classes:

1. Hardhat
2. Mask
3. NO-Hardhat
4. NO-Mask
5. NO-Safety Vest
6. Person
7. Safety Cone
8. Safety Vest
9. machinery
10. vehicle

The exported model metadata identifies the Ultralytics license as AGPL-3.0.
The source repository does not show a separate explicit license for its custom
weight or training dataset. Treat this model as a hackathon prototype asset and
complete a license review or replace it with an independently trained model
before commercial distribution.
