"""
Script to collect training data for sign language translation gestures.
Run this script to record hand gesture data for model training.
Modified to collect data for 3 basic signs only.
"""
import cv2
import mediapipe as mp
import numpy as np
import os
import time

# Initialize MediaPipe
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Create directories
data_dir = 'translation_data'
os.makedirs(data_dir, exist_ok=True)

# Signs to collect - 3 basic gestures for translation
signs = ['hello', 'thanks', 'yes']  # Reduced to 3 basic signs
num_sequences = 20  # Reduced number of sequences for faster training
sequence_length = 30  # Number of frames per sequence

# Initialize webcam
cap = cv2.VideoCapture(0)

for sign in signs:
    # Create directory for this sign
    sign_dir = os.path.join(data_dir, sign)
    os.makedirs(sign_dir, exist_ok=True)
    
    print(f"\n{'='*50}")
    print(f"COLLECTING DATA FOR SIGN: {sign.upper()}")
    print(f"{'='*50}\n")
    
    for sequence in range(num_sequences):
        # Show preparation screen
        print(f"Preparing for sequence {sequence+1}/{num_sequences}")
        print("Please position yourself and press 'q' when ready")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
                
            # Display instructions
            cv2.putText(frame, f"SIGN: {sign.upper()}", (10, 50), 
                      cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(frame, f"Sequence: {sequence+1}/{num_sequences}", (10, 90), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(frame, "Press 'q' when ready", (10, 130), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            
            # Process the frame with MediaPipe to show hand tracking
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    mp_drawing.draw_landmarks(
                        frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            
            cv2.imshow('Data Collection', frame)
            
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break
        
        # Countdown
        for count in range(3, 0, -1):
            ret, frame = cap.read()
            if not ret:
                continue
                
            cv2.putText(frame, str(count), (int(frame.shape[1]/2), int(frame.shape[0]/2)), 
                      cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 0, 255), 4)
            cv2.imshow('Data Collection', frame)
            cv2.waitKey(1000)
        
        # Start collecting
        print(f"Recording sequence {sequence+1} for {sign}...")
        
        # Container for landmarks
        sequence_data = []
        frame_count = 0
        
        # Record until we have enough frames with hand landmarks
        while len(sequence_data) < sequence_length:
            ret, frame = cap.read()
            if not ret:
                continue
                
            # Process the frame
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)
            
            # Draw hand landmarks
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    mp_drawing.draw_landmarks(
                        frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                    
                    # Extract landmarks
                    landmarks = []
                    for lm in hand_landmarks.landmark:
                        landmarks.append([lm.x, lm.y, lm.z])
                    
                    sequence_data.append(landmarks)
            
            # Display recording status
            frame_count += 1
            cv2.putText(frame, f"RECORDING: {len(sequence_data)}/{sequence_length}", (10, 50), 
                      cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            cv2.imshow('Data Collection', frame)
            
            # Small delay between frames
            cv2.waitKey(40)
            
            # If we've processed too many frames without detecting enough hands, break
            if frame_count > 120:  # Give up after ~4 seconds
                break
        
        # Save the sequence
        if len(sequence_data) >= sequence_length * 0.7:  # At least 70% frames with hands
            # Save as numpy array
            filename = os.path.join(sign_dir, f"seq_{sequence}.npy")
            
            # Pad or truncate to ensure consistent length
            if len(sequence_data) < sequence_length:
                # Pad with last frame if needed
                last_frame = sequence_data[-1]
                while len(sequence_data) < sequence_length:
                    sequence_data.append(last_frame)
            elif len(sequence_data) > sequence_length:
                # Truncate if needed
                sequence_data = sequence_data[:sequence_length]
            
            np.save(filename, np.array(sequence_data))
            print(f"Saved {filename} ({len(sequence_data)} frames)")
        else:
            print(f"Not enough frames with hand landmarks. Retrying sequence {sequence+1}...")
            sequence -= 1  # Retry this sequence
            
        # Short pause between sequences
        time.sleep(1)

cap.release()
cv2.destroyAllWindows()
print("\nData collection complete!")