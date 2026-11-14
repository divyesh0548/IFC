import os
import unittest
from unittest.mock import patch

from flask import Flask

from app.routes_risk_analysis import risk_analysis_bp
from services.risk_analysis import service


class RiskAnalysisWithoutOverviewTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(risk_analysis_bp)
        self.client = app.test_client()
        self.risks = [{"subProcess": "Invoice processing", "risk": "Duplicate invoices are paid."}]
        self.control = {"control_number": "P2P1", "sub_process": "Invoice processing"}

    def generate(self, endpoint, payload):
        # Exercise the actual routes, prompt builders and dry-run service path.
        # No model requests or credentials are needed.
        with patch.dict(os.environ, {"AI_SUMMARY_API_KEY": "test-key"}), \
                patch.object(service, "provider_name", return_value="test"), \
                patch.object(service, "resolve_model", return_value="test-model"), \
                patch.object(service, "complete_json") as complete:
            response = self.client.post(
                f"/v1/risk-analysis/{endpoint}",
                headers={"X-API-Key": "test-key"},
                json={**payload, "dry_run": True},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            prompt = response.get_json()["dry_run_txt"]
            self.assertIn("Procure to Pay", prompt)
            self.assertIn("Duplicate invoices are paid.", prompt)
            self.assertNotIn("{business_process_overview}", prompt)
            self.assertNotIn("{concise_risks_json}", prompt)
            self.assertIn("do not invent client-specific", prompt.lower())
            complete.assert_not_called()
            return prompt

    def test_control_generation_without_overview(self):
        prompt = self.generate("analyze", {
            "business_process": "Procure to Pay", "control": self.control,
            "concise_risks": self.risks,
        })
        self.assertIn("P2P1", prompt)
        self.assertIn("Partially Covered Risk", prompt)

    def test_overall_generation_without_overview(self):
        self.generate("overall-missing", {
            "business_process": "Procure to Pay", "concise_risks": self.risks,
        })

    def test_invalid_risk_list_still_rejected(self):
        with patch.dict(os.environ, {"AI_SUMMARY_API_KEY": "test-key"}):
            for endpoint in ("analyze", "overall-missing"):
                response = self.client.post(
                    f"/v1/risk-analysis/{endpoint}",
                    headers={"X-API-Key": "test-key"},
                    json={"business_process": "Procure to Pay", "control": self.control,
                          "concise_risks": "invalid"},
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["message"], "concise_risks must be an array")


if __name__ == "__main__":
    unittest.main()
