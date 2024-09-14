from ._anvil_designer import Max_CalculatorTemplate
from anvil import *
import anvil.server
import anvil.tables as tables
import anvil.tables.query as q
from anvil.tables import app_tables

class Max_Calculator(Max_CalculatorTemplate):
  def __init__(self, **properties):
    # Set Form properties and Data Bindings.
    self.init_components(**properties)

  def calculate_click(self, **event_args):
    """This method is called when the button is clicked"""
    self.output.text = int(self.weight.text*(1 + self.reps.text/30))
    self.rich_text_1.visible = True
    self.disclaimer.text = "1RM Estimation Calculator: results are calculated using Epley’s Equation: 1RM = Weight (1 + Reps/30)."
    self.link_1.text = "(This is one of the most accurate formulas for calculating 1RM in the squat, bench press, and deadlift)"


    
