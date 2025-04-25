test:
	python3 run.py --mode debug

nexus:
	python3 run.py --mode production 

controller:
	python3 -m utils_rov.main --controller
