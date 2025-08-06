for f in "./test-manifests/"*; do
  echo "Applying $f"
  kubectl apply -f "$f"
done
