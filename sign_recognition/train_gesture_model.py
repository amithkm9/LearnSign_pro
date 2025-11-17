"""
Script to train a sign language translation model.
Uses collected gesture data to train a classifier for sign recognition.
Modified to train on 3 basic signs only.
"""
import os
import numpy as np
import pickle
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import ModelCheckpoint, ReduceLROnPlateau, EarlyStopping
from tensorflow.keras.optimizers import Adam
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

# Parameters
data_dir = 'translation_data'
model_dir = 'translation_models'
os.makedirs(model_dir, exist_ok=True)

# Signs to recognize - reduced to 3 basic signs
signs = ['hello', 'thanks', 'yes']
sequence_length = 30  # frames per sequence
num_landmarks = 21  # MediaPipe hand landmarks
num_coords = 3  # x, y, z coordinates

def preprocess_landmarks(landmarks_sequence):
    """Normalize and preprocess hand landmarks"""
    # Ensure we have the right number of frames
    if len(landmarks_sequence) < sequence_length:
        # Pad with the last frame
        last_frame = landmarks_sequence[-1]
        landmarks_sequence = landmarks_sequence + [last_frame] * (sequence_length - len(landmarks_sequence))
    elif len(landmarks_sequence) > sequence_length:
        # Truncate
        landmarks_sequence = landmarks_sequence[:sequence_length]
    
    # Flatten landmarks for each frame
    flattened_sequence = []
    for landmarks in landmarks_sequence:
        # Convert to numpy array if not already
        landmarks = np.array(landmarks)
        
        # Center the landmarks around the wrist
        wrist = landmarks[0]  # Wrist is the first landmark in MediaPipe
        centered = landmarks - wrist
        
        # Normalize for scale
        max_dist = np.max(np.abs(centered))
        if max_dist > 0:
            normalized = centered / max_dist
        else:
            normalized = centered
        
        # Flatten to 1D array
        flattened = normalized.flatten()
        flattened_sequence.append(flattened)
    
    return np.array(flattened_sequence)

def load_dataset():
    """Load and preprocess all sign sequences"""
    X = []  # Sequences
    y = []  # Labels
    
    for sign_idx, sign in enumerate(signs):
        sign_dir = os.path.join(data_dir, sign)
        if not os.path.exists(sign_dir):
            print(f"Warning: Directory for '{sign}' not found!")
            continue
        
        files = [f for f in os.listdir(sign_dir) if f.endswith('.npy')]
        if not files:
            print(f"Warning: No data files found for '{sign}'")
            continue
            
        print(f"Loading {len(files)} sequences for sign '{sign}'")
        
        for file_name in files:
            try:
                # Load the sequence
                file_path = os.path.join(sign_dir, file_name)
                sequence = np.load(file_path)
                
                # Preprocess
                processed_sequence = preprocess_landmarks(sequence)
                
                # Add to dataset
                X.append(processed_sequence)
                y.append(sign_idx)
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
    
    return np.array(X), np.array(y)

def create_model(input_shape, num_classes):
    """Create a LSTM model for sign recognition"""
    model = Sequential([
        # LSTM layers
        LSTM(64, return_sequences=True, input_shape=input_shape),
        BatchNormalization(),
        Dropout(0.3),
        
        LSTM(128, return_sequences=True),
        BatchNormalization(),
        Dropout(0.3),
        
        LSTM(64),
        BatchNormalization(),
        Dropout(0.3),
        
        # Dense layers
        Dense(64, activation='relu'),
        BatchNormalization(),
        Dropout(0.3),
        
        Dense(32, activation='relu'),
        BatchNormalization(),
        
        # Output layer
        Dense(num_classes, activation='softmax')
    ])
    
    # Compile
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def train_model():
    """Load data and train the model"""
    # Load dataset
    X, y = load_dataset()
    
    if len(X) == 0 or len(y) == 0:
        print("No data to train on!")
        return
    
    print(f"Dataset: {len(X)} sequences, {len(signs)} classes")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Define input shape
    input_shape = (sequence_length, num_landmarks * num_coords)
    
    # Create model
    model = create_model(input_shape, len(signs))
    print(model.summary())
    
    # Callbacks
    checkpoint = ModelCheckpoint(
        os.path.join(model_dir, 'gesture_model.h5'),
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    )
    
    reduce_lr = ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=10,
        min_lr=0.0001,
        verbose=1
    )
    
    early_stopping = EarlyStopping(
        monitor='val_loss',
        patience=20,
        restore_best_weights=True,
        verbose=1
    )
    
    # Train - using fewer epochs for faster training
    epochs = 50  # Reduced from 100
    batch_size = 16
    
    print("\nTraining model...")
    history = model.fit(
        X_train, y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_data=(X_test, y_test),
        callbacks=[checkpoint, reduce_lr, early_stopping]
    )
    
    # Save sign labels
    with open(os.path.join(model_dir, 'gesture_labels.pkl'), 'wb') as f:
        pickle.dump(signs, f)
    
    # Plot training history
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'], label='Train')
    plt.plot(history.history['val_accuracy'], label='Validation')
    plt.title('Model Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Train')
    plt.plot(history.history['val_loss'], label='Validation')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig(os.path.join(model_dir, 'training_history.png'))
    
    # Evaluate on test set
    test_loss, test_acc = model.evaluate(X_test, y_test)
    print(f"\nTest accuracy: {test_acc:.4f}")
    print(f"Model saved to: {os.path.join(model_dir, 'gesture_model.h5')}")

if __name__ == "__main__":
    train_model()