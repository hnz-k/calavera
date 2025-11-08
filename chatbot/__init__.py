from flask import Blueprint
import os

current_dir = os.path.dirname(os.path.abspath(__file__))

chatbot_bp = Blueprint('chatbot', __name__, 
                       template_folder=os.path.join(current_dir, 'templates'))

from . import routes