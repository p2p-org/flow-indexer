FROM python:3.8
WORKDIR /usr/src/app

RUN pip3 install requests python-dotenv pika pino

EXPOSE 3000

CMD ["python3", "-u", "processor.py"]

