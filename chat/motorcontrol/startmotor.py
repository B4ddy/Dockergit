from scapy.all import Ether, IP, UDP, Raw, sendp, hexdump
import time
import struct
ip = "a9fe0001"
def create_hini_payload(counter):
    seg1 = bytes.fromhex("48494e49000003e8000000030000")
    seg2 = struct.pack(">H", counter)
    seg3 = bytes.fromhex("0000207e00000000a9fe020000006328")
    seg4 = bytes.fromhex(ip+"e41fe90038bb000000010000")
    seg5 = bytes.fromhex("10450000000000000000000000000000")
    seg6 = bytes.fromhex("00000000000000000000000000000000")
    seg7 = bytes.fromhex("00000000000000000000000000000000")
    seg8 = bytes.fromhex("00000000000000000000000000000000")
    seg9 = bytes.fromhex("0000ffff0000")
    
    payload = seg1 + seg2 + seg3 + seg4 + seg5 + seg6 + seg7 + seg8 + seg9
    return payload


def send_hini_packets(iface):
    # Ethernet-Einstellungen
    src_mac = "00:50:b6:80:aa:c2"
    # Im Header-Beispiel ist die Zieladresse Broadcast – andernfalls anpassen
    dst_mac = "ff:ff:ff:ff:ff:ff"

    # IP-Einstellungen
    src_ip = "169.254.0.32"
    dst_ip = "255.255.255.255"

    # UDP-Einstellungen
    sport = 25384  # Quellport (0x6328)
    dport = 25383  # Zielport (0x6327)

    # Startwert für den Counter (wie in deinen Beispielen z. B. 0x074b)
    counter = 0x074b

    print(f"Sende HINI-Pakete über Interface {iface} ...")
    for i in range(5):
        # Erstelle Payload mit aktuellem Counter
        payload = create_hini_payload(counter)

        # Paket zusammensetzen
        pkt = (
            Ether(src=src_mac, dst=dst_mac) /
            IP(src=src_ip, dst=dst_ip, ttl=128) /
            UDP(sport=sport, dport=dport) /
            Raw(load=payload)
        )

        print(f"\nPaket {i+1} mit Counter 0x{counter:04x}:")
        hexdump(pkt)
        sendp(pkt, iface=iface, verbose=False)

        # Counter erhöhen (in deinen Beispielen um 120)
        counter += 120
        time.sleep(0.1)