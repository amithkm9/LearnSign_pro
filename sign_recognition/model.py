"""
Sign language recognition model implementation.
This module handles the machine learning model for sign language detection.
"""
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional, BatchNormalization
from tensorflow.keras.callbacks import ModelCheckpoint, ReduceLROnPlateau, EarlyStopping
from tensorflow.keras.optimizers import Adam
from sklearn.model_selection import train_test_split
import os
import pickle
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class SignLanguageModel:
    def __init__(self):
        # Model parameters
        self.num_landmarks = 21  # MediaPipe hand landmarks
        self.num_coords = 3      # x, y, z coordinates
        self.sequence_length = 30  # Frames per sign
        self.classes = ['one', 'two', 'three', 'a', 'b', 'c']  # Signs to detect - UPDATED
        
        # Paths
        self.model_dir = os.path.join(os.path.dirname(__file__), 'models')
        os.makedirs(self.model_dir, exist_ok=True)
        
        # Try both model naming patterns
        self.model_path = os.path.join(self.model_dir, 'sign_language_model.h5')
        self.scaler_path = os.path.join(self.model_dir, 'scaler.pkl')
        
        # Alternative paths for numbers_letters model
        self.alt_model_path = os.path.join(self.model_dir, 'sign_language_numbers_letters.h5')
        self.alt_scaler_path = os.path.join(self.model_dir, 'scaler_numbers_letters.pkl')
        
        # Load model if exists
        self.model = None
        self.scaler = None
        
        # Try loading with primary paths
        if os.path.exists(self.model_path):
            try:
                logger.info(f"Loading model from {self.model_path}")
                self.model = load_model(self.model_path)
                
                # Load scaler if exists
                if os.path.exists(self.scaler_path):
                    with open(self.scaler_path, 'rb') as f:
                        self.scaler = pickle.load(f)
            except Exception as e:
                logger.error(f"Error loading model from primary path: {e}")
                logger.error(traceback.format_exc())
                self.model = None
        else:
            logger.info(f"Model not found at {self.model_path}, trying alternative path")
        
        # If primary load failed, try alternative paths
        if self.model is None and os.path.exists(self.alt_model_path):
            try:
                logger.info(f"Loading model from alternative path {self.alt_model_path}")
                self.model = load_model(self.alt_model_path)
                self.model_path = self.alt_model_path  # Update path if successful
                
                # Load scaler if exists
                if os.path.exists(self.alt_scaler_path):
                    with open(self.alt_scaler_path, 'rb') as f:
                        self.scaler = pickle.load(f)
                    self.scaler_path = self.alt_scaler_path  # Update path if successful
            except Exception as e:
                logger.error(f"Error loading model from alternative path: {e}")
                logger.error(traceback.format_exc())
        
        # If no model could be loaded, create a fresh one
        if self.model is None:
            logger.warning("No existing model found. Creating a new model...")
            self.create_model()
    
    def preprocess_landmarks(self, landmarks_sequence):
        """Normalize and preprocess hand landmarks"""
        try:
            # Convert to list if it's a numpy array
            if isinstance(landmarks_sequence, np.ndarray):
                landmarks_sequence = landmarks_sequence.tolist()
            
            # Ensure we have the right number of frames
            if len(landmarks_sequence) < self.sequence_length:
                # Pad with the last frame
                last_frame = landmarks_sequence[-1]
                landmarks_sequence = landmarks_sequence + [last_frame] * (self.sequence_length - len(landmarks_sequence))
            elif len(landmarks_sequence) > self.sequence_length:
                # Truncate
                landmarks_sequence = landmarks_sequence[:self.sequence_length]
            
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
        except Exception as e:
            logger.error(f"Error in preprocess_landmarks: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def create_model(self):
        """Create a new LSTM model for sign language recognition"""
        try:
            # Input shape: [sequence_length, features]
            input_shape = (self.sequence_length, self.num_landmarks * self.num_coords)
            num_classes = len(self.classes)
            
            model = Sequential([
                # First LSTM layer with bidirectional wrapper
                Bidirectional(LSTM(64, return_sequences=True), input_shape=input_shape),
                BatchNormalization(),
                Dropout(0.3),
                
                # Second LSTM layer
                Bidirectional(LSTM(128, return_sequences=True)),
                BatchNormalization(),
                Dropout(0.3),
                
                # Third LSTM layer
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
            
            # Compile with Adam optimizer
            model.compile(
                optimizer=Adam(learning_rate=0.001),
                loss='categorical_crossentropy',
                metrics=['categorical_accuracy']
            )
            
            self.model = model
            logger.info("Created new model")
            return model
        except Exception as e:
            logger.error(f"Error creating model: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def prepare_data_from_directory(self, data_dir):
        """Load and preprocess training data from directory"""
        try:
            X = []
            y = []
            
            logger.info(f"Loading data from {data_dir}")
            for class_idx, class_name in enumerate(self.classes):
                class_dir = os.path.join(data_dir, class_name)
                
                if not os.path.exists(class_dir):
                    logger.warning(f"Warning: Directory for class {class_name} not found at {class_dir}")
                    continue
                
                logger.info(f"Processing class: {class_name}")
                files = [f for f in os.listdir(class_dir) if f.endswith('.npy')]
                logger.info(f"Found {len(files)} sequences")
                
                for file_name in files:
                    file_path = os.path.join(class_dir, file_name)
                    sequence = np.load(file_path)
                    
                    # Preprocess landmarks
                    processed_sequence = self.preprocess_landmarks(sequence)
                    X.append(processed_sequence)
                    y.append(class_idx)
            
            return np.array(X), np.array(y)
        except Exception as e:
            logger.error(f"Error preparing data: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def train(self, X, y, epochs=100, batch_size=16, validation_split=0.2):
        """Train the model with sign language data"""
        try:
            if self.model is None:
                self.create_model()
            
            logger.info(f"Training model with {len(X)} sequences")
            logger.info(f"X shape: {X.shape}, y shape: {y.shape}")
            
            # Convert labels to one-hot encoding
            y_categorical = tf.keras.utils.to_categorical(y, num_classes=len(self.classes))
            
            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                X, y_categorical, test_size=validation_split, random_state=42
            )
            
            # Callbacks
            checkpoint = ModelCheckpoint(
                self.model_path,
                monitor='val_categorical_accuracy',
                verbose=1,
                save_best_only=True,
                mode='max'
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
            
            # Train the model
            history = self.model.fit(
                X_train, y_train,
                epochs=epochs,
                batch_size=batch_size,
                validation_data=(X_val, y_val),
                callbacks=[checkpoint, reduce_lr, early_stopping]
            )
            
            # Load the best model
            self.model = load_model(self.model_path)
            
            return history
        except Exception as e:
            logger.error(f"Error training model: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def predict(self, landmarks_sequence):
        """Predict sign from a sequence of hand landmarks"""
        try:
            if self.model is None:
                raise ValueError("Model not initialized. Create or load a model first.")
            
            if not landmarks_sequence:
                logger.warning("No landmarks provided for prediction")
                return "unknown", 0.0
            
            # Preprocess the landmarks
            processed_sequence = self.preprocess_landmarks(landmarks_sequence)
            
            # Add batch dimension
            X = np.expand_dims(processed_sequence, axis=0)
            
            # Make prediction
            logger.debug(f"Making prediction with processed sequence shape: {X.shape}")
            prediction = self.model.predict(X, verbose=0)[0]
            
            # Get class and confidence
            predicted_class_idx = np.argmax(prediction)
            confidence = prediction[predicted_class_idx]
            
            logger.debug(f"Raw prediction: {prediction}")
            logger.debug(f"Predicted index: {predicted_class_idx}, Confidence: {confidence}")
            
            if confidence < 0.35:
                logger.info(f"Low confidence prediction: {confidence:.4f}")
                return "uncertain", float(confidence)
            
            if predicted_class_idx >= len(self.classes):
                logger.warning(f"Predicted index {predicted_class_idx} out of range for classes {self.classes}")
                return "unknown", float(confidence)
            
            return self.classes[predicted_class_idx], float(confidence)
        
        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            logger.error(traceback.format_exc())
            return "error", 0.0