"""
Sign language model training script.
Modified to train on numbers 1,2,3 and letters a,b,c.
Run this after collecting data to train the sign language recognition model.
"""
import os
import numpy as np
from model import SignLanguageModel
import tensorflow as tf
import matplotlib.pyplot as plt

# Enable eager execution explicitly
tf.config.run_functions_eagerly(True)

def plot_training_history(history):
    """Plot training and validation metrics"""
    # Create directory for plots
    plots_dir = os.path.join('models', 'plots')
    os.makedirs(plots_dir, exist_ok=True)
    
    # Plot accuracy
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history.history['categorical_accuracy'], label='Training Accuracy')
    plt.plot(history.history['val_categorical_accuracy'], label='Validation Accuracy')
    plt.title('Model Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, 'training_history_numbers_letters.png'))
    plt.close()
    
    print(f"Training plots saved to {plots_dir}")

def main():
    print("=" * 50)
    print("SIGN LANGUAGE RECOGNITION MODEL TRAINING - NUMBERS AND LETTERS")
    print("=" * 50)
    
    # Set memory growth to avoid OOM errors
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            print(f"Found {len(gpus)} GPU(s). Memory growth enabled.")
        except RuntimeError as e:
            print(f"Error setting memory growth: {e}")
    
    # Create a custom model instance for numbers and letters
    model = SignLanguageModel()
    
    # Override the default classes with our numbers and letters
    model.classes = ['one', 'two', 'three', 'a', 'b', 'c']
    
    # Update the model path to avoid overwriting the translation model
    model.model_path = os.path.join(os.path.dirname(__file__), 'models', 'sign_language_numbers_letters.h5')
    model.scaler_path = os.path.join(os.path.dirname(__file__), 'models', 'scaler_numbers_letters.pkl')
    
    # Data directory
    data_dir = os.path.join(os.path.dirname(__file__), 'training_data')
    
    if not os.path.exists(data_dir):
        print(f"Error: Training data directory '{data_dir}' not found.")
        print("Please run collect_data.py first to gather training data.")
        return
    
    # Load and preprocess data
    print("\nPreparing training data...")
    X, y = model.prepare_data_from_directory(data_dir)
    
    if len(X) == 0:
        print("No training data found! Please run collect_data.py first.")
        return
    
    print(f"\nLoaded {len(X)} training sequences")
    print(f"Data shape: {X.shape}")
    print(f"Labels: {np.unique(y)}")
    
    # Class distribution
    classes, counts = np.unique(y, return_counts=True)
    for i, cls in enumerate(classes):
        class_name = model.classes[cls] if cls < len(model.classes) else "Unknown"
        print(f"Class {class_name}: {counts[i]} samples")
    
    # Train model with fewer epochs for faster training
    print("\nTraining model...")
    epochs = 30
    batch_size = 16
    
    history = model.train(
        X, y,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=0.2
    )
    
    # Plot training history
    plot_training_history(history)
    
    print("\nTraining complete!")
    print(f"Model saved to: {os.path.join('models', 'sign_language_numbers_letters.h5')}")

if __name__ == "__main__":
    main()